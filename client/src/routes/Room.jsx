import React from "react";
import io from "socket.io-client";

const Room = (props) => {
  const [camera, setCamera] = React.useState("front_camera");
  const userVideo = React.useRef();
  const partnerVideo = React.useRef();
  const peerRef = React.useRef();
  const socketRef = React.useRef();
  const otherUser = React.useRef();
  const userStream = React.useRef();
  const senders = React.useRef([]);

  React.useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({
        audio: false,
        video: {
          facingMode: camera === "front_camera" ? "user" : "environment",
        },
      })
      .then((stream) => {
        userVideo.current.srcObject = stream;
        userStream.current = stream;

        socketRef.current = io.connect("/");
        socketRef.current.emit("join room", props.match.params.roomID);

        socketRef.current.on("other user", (userID) => {
          callUser(userID);
          otherUser.current = userID;
        });

        socketRef.current.on("user joined", (userID) => {
          otherUser.current = userID;
        });

        socketRef.current.on("offer", handleReceiveCall);
        socketRef.current.on("answer", handleAnswer);
        socketRef.current.on("ice-candidate", handleNewICECandidateMsg);
      }).catch(e => console.log(e));
  }, [camera]);

  React.useEffect(() => {
    document.addEventListener("visibilitychange", (event) => {
      if (document.visibilityState === "visible") {
        if (document.pictureInPictureElement) {
          document.exitPictureInPicture();
        }
      }
    });
  }, []);

  function callUser(userId) {
    peerRef.current = createPeer(userId);
    userStream.current
      .getTracks()
      .forEach((track) =>
        senders.current.push(
          peerRef.current.addTrack(track, userStream.current)
        )
      );
  }

  function createPeer(userId) {
    const peer = new RTCPeerConnection({
      iceServers: [
        {
          urls: "stun:stun.stunprotocol.org",
        },
        {
          urls: "turn:numb.viagenie.ca",
          credential: "muazkh",
          username: "webrtc@live.com",
        },
      ],
    });
    peer.onicecandidate = handleICECandidateEvent;
    peer.ontrack = handleTrackEvent;
    peer.onnegotiationneeded = () => handleNegotiationNeededEvent(userId);

    return peer;
  }

  function handleNegotiationNeededEvent(userId) {
    peerRef.current
      .createOffer()
      .then((offer) => {
        return peerRef.current.setLocalDescription(offer);
      })
      .then(() => {
        const payload = {
          target: userId,
          caller: socketRef.current.id,
          sdp: peerRef.current.localDescription,
        };
        socketRef.current.emit("offer", payload);
      })
      .catch((e) => console.log(e));
  }

  function handleReceiveCall(incoming) {
    peerRef.current = createPeer();
    const desc = new RTCSessionDescription(incoming.sdp);
    peerRef.current
      .setRemoteDescription(desc)
      .then(() => {
        userStream.current
          .getTracks()
          .forEach((track) =>
            peerRef.current.addTrack(track, userStream.current)
          );
      })
      .then(() => {
        return peerRef.current.createAnswer();
      })
      .then((answer) => {
        return peerRef.current.setLocalDescription(answer);
      })
      .then(() => {
        const payload = {
          target: incoming.caller,
          caller: socketRef.current.id,
          sdp: peerRef.current.localDescription,
        };
        socketRef.current.emit("answer", payload);
      });
  }

  function handleAnswer(message) {
    const desc = new RTCSessionDescription(message.sdp);
    peerRef.current.setRemoteDescription(desc).catch((e) => console.log(e));
  }

  function handleICECandidateEvent(e) {
    if (e.candidate) {
      const payload = {
        target: otherUser.current,
        candidate: e.candidate,
      };
      socketRef.current.emit("ice-candidate", payload);
    }
  }

  function handleNewICECandidateMsg(incoming) {
    const candidate = new RTCIceCandidate(incoming);

    peerRef.current.addIceCandidate(candidate).catch((e) => console.log(e));
  }

  function handleTrackEvent(e) {
    partnerVideo.current.srcObject = e.streams[0];
  }

  function requestPictureInPicture() {
    partnerVideo.current.requestPictureInPicture();
  }

  function shareScreen() {
    navigator.mediaDevices.getDisplayMedia({ cursor: true }).then((stream) => {
      const screenTrack = stream.getTracks()[0];
      console.log(senders);
      senders.current
        .find((sender) => sender.track.kind === "video")
        .replaceTrack(screenTrack);
      console.log(senders);
      screenTrack.onended = function () {
        senders.current
          .find((sender) => sender.track.kind === "video")
          .replaceTrack(userStream.current.getTracks()[1]);
      };
    });
  }

  function copyLink() {
    navigator.clipboard.writeText(
      "https://video-app-18v8.onrender.com/rooms/" + props.match.params.roomID
    );
  }

  function changeCamera(event) {
      setCamera(event.target.value);
  }

  return (
    <div>
      <video controls autoPlay ref={userVideo}></video>
      <video controls autoPlay ref={partnerVideo}></video>
      <select onChange={(e) => changeCamera(e)}>
        <option value="back_camera">Back Camera</option>
        <option value="front_camera">Front Camera</option>
      </select>
      <button onClick={shareScreen}>Share Screen</button>
      <button onClick={copyLink}>Copy Link</button>
      <button onClick={requestPictureInPicture}>
        Request picture in picture{" "}
      </button>
    </div>
  );
};

export default Room;
