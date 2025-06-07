import React, { useState, useEffect, useRef } from "react"
import {
  signOut,
} from "https://www.gstatic.com/firebasejs/10.1.0/firebase-auth.js"
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  addDoc,
  onSnapshot,
  arrayUnion,
  arrayRemove,
  query,
  orderBy,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.1.0/firebase-firestore.js"

import DefaultPic from "../assets/default.jpeg"

export default function LoggedInView({ user, auth }) {
  const db = getFirestore()
  const uid = user.uid
  const photoURL = user.photoURL ?? DefaultPic

  // State
  const [role, setRole] = useState(null)
  const [loadingRole, setLoadingRole] = useState(true)
  const [displayNameInput, setDisplayNameInput] = useState(user.displayName ?? "")
  const [savingDisplayName, setSavingDisplayName] = useState(false)

  const [newRoomName, setNewRoomName] = useState("")
  const [newRoomPassword, setNewRoomPassword] = useState("")

  const [rooms, setRooms] = useState([])
  const [ownRooms, setOwnRooms] = useState([])
  const [loadingRooms, setLoadingRooms] = useState(true)

  const [selectedRoom, setSelectedRoom] = useState(null)
  const [selectedRoomMembers, setSelectedRoomMembers] = useState([])
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")

  // Chat state
  const [chatPeer, setChatPeer] = useState(null)       // { uid, displayName }
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState("")
  const chatEndRef = useRef(null)
  const unsubChat = useRef(null)

  // 1) Load user role & displayName
  useEffect(() => {
    getDoc(doc(db, "users", uid))
      .then(snap => {
        if (snap.exists()) {
          const d = snap.data()
          setRole(d.role ?? null)
          setDisplayNameInput(d.displayName ?? "")
        }
      })
      .finally(() => setLoadingRole(false))
  }, [db, uid])

  // 2) Subscribe to rooms
  useEffect(() => {
    if (loadingRole) return
    const roomsCol = collection(db, "rooms")

    if (role === "tenant") {
      const unsub = onSnapshot(roomsCol, snap => {
        setRooms(snap.docs.map(d => ({ id: d.id, ...d.data() })))
        setLoadingRooms(false)
      })
      return unsub
    }

    if (role === "landlord") {
      const unsub = onSnapshot(roomsCol, snap => {
        setOwnRooms(
          snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(r => r.landlordId === uid)
        )
        setLoadingRooms(false)
      })
      return unsub
    }

    setRooms([]); setOwnRooms([]); setLoadingRooms(false)
  }, [db, role, uid, loadingRole])

  // 3) Set role
  const handleSetRole = async r => {
    await setDoc(doc(db, "users", uid), {
      role: r,
      email: user.email,
      displayName: displayNameInput
    })
    setRole(r)
  }

  // 4) Save display name
  const handleSaveDisplayName = async () => {
    const name = displayNameInput.trim()
    if (!name) return alert("Display Name cannot be empty.")
    setSavingDisplayName(true)
    await updateDoc(doc(db, "users", uid), { displayName: name })
    setSavingDisplayName(false)
    alert("Display Name updated!")
    if (selectedRoom) fetchAndSelectRoom(selectedRoom.id)
  }

  // 5) Create room
  const handleCreateRoom = async () => {
    if (!displayNameInput.trim()) return alert("Set Display Name first.")
    const n = newRoomName.trim(), p = newRoomPassword.trim()
    if (!n || !p) return alert("Name & password required.")
    await addDoc(collection(db, "rooms"), {
      name: n,
      landlordId: uid,
      password: p,
      members: [],
      createdAt: Date.now()
    })
    setNewRoomName(""); setNewRoomPassword("")
    alert("Room created!")
  }

  // 6) Join room
  const handleJoinRoom = async (id, pwd) => {
    if (!displayNameInput.trim()) return alert("Set Display Name first.")
    const room = rooms.find(r => r.id === id)
    if (!room) return alert("Not found")
    if (pwd !== room.password) return alert("Wrong password")
    await updateDoc(doc(db, "rooms", id), { members: arrayUnion(uid) })
    alert("Room Joined!")
    fetchAndSelectRoom(id)
  }

  // 7) Leave room
  const handleLeaveRoom = async () => {
    if (!selectedRoom) return
    let leaveroomconfirm = confirm("Are you sure you want to leave this room?")
    if (leaveroomconfirm){
      await updateDoc(doc(db, "rooms", selectedRoom.id), {
        members: arrayRemove(uid)
      })
      alert("Left room")
      setSelectedRoom(null)
      setSelectedRoomMembers([])
      clearChat()
    }
  }

  // 8) Remove tenant
  const handleRemoveTenant = async tUid => {
    if (!selectedRoom) return
    let removetenantconfirm = confirm("Are you sure you want to remove this tenant?")
    if (!removetenantconfirm) return
    await updateDoc(doc(db, "rooms", selectedRoom.id), {
      members: arrayRemove(tUid)
    })
    fetchAndSelectRoom(selectedRoom.id)
  }

  // 9) Fetch & select room
  const fetchAndSelectRoom = async id => {
    setLoadingMembers(true)
    const snap = await getDoc(doc(db, "rooms", id))
    if (snap.exists()) selectRoom({ id: snap.id, ...snap.data() })
    setLoadingMembers(false)
    clearChat()
  }

  // Helper: load members
  const selectRoom = async room => {
    setSelectedRoom(room)
    setLoadingMembers(true)
    const ids = [...(room.members || [])]
    if (room.landlordId && !ids.includes(room.landlordId)) ids.push(room.landlordId)
    const docs = await Promise.all(ids.map(i => getDoc(doc(db, "users", i))))
    setSelectedRoomMembers(docs.map(d => ({
      uid: d.id,
      displayName: d.data()?.displayName || d.data()?.email,
      isLandlord: d.id === room.landlordId
    })))
    setLoadingMembers(false)
  }

  // Clear any chat listener & state
  const clearChat = () => {
    setChatPeer(null)
    setMessages([])
    if (unsubChat.current) unsubChat.current()
  }

  // 10) Start private chat
  const startChatWith = peer => {
    setChatPeer(peer)
    setMessages([])
    if (unsubChat.current) unsubChat.current()

    const chatId = [uid, peer.uid].sort().join("_")
    const msgsCol = collection(
      db,
      "rooms",
      selectedRoom.id,
      "chats",
      chatId,
      "messages"
    )
    const q = query(msgsCol, orderBy("timestamp", "asc"))
    unsubChat.current = onSnapshot(q, snap => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setTimeout(() =>
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" }),
      100)
    })
  }

  // 11) Send message
  const handleSendMessage = async () => {
    const text = newMessage.trim()
    if (!text || !chatPeer) return
    const chatId = [uid, chatPeer.uid].sort().join("_")
    const msgsCol = collection(
      db,
      "rooms",
      selectedRoom.id,
      "chats",
      chatId,
      "messages"
    )
    await addDoc(msgsCol, {
      senderId: uid,
      text,
      timestamp: serverTimestamp()
    })
    setNewMessage("")
  }

  // 12) Delete room
  const handleDeleteRoom = () => {
    if (!selectedRoom) return
    let deleteroomconfirm = confirm("Are you sure you want to delete this room?")
    if (!deleteroomconfirm) return
    deleteDoc(doc(db, "rooms", selectedRoom.id))
    setSelectedRoom(null)
    setSelectedRoomMembers([])
  }

  // 13) Format timestamp
  const formatTimestamp = ts => {
    const d = new Date(ts?.seconds * 1000)
    if (!ts) return "loading date..."
    return `${d.toLocaleTimeString(undefined, { timeStyle: "short" })} - ${d.toLocaleDateString(undefined, { dateStyle: "medium" })}`
  }

  // Auto-start chat for tenant when members load
  useEffect(() => {
    if (role === "tenant" && selectedRoomMembers.length > 0) {
      const landlord = selectedRoomMembers.find(m => m.isLandlord)
      if (landlord) startChatWith(landlord)
    }
  }, [role, selectedRoomMembers])

  // Cleanup on unmount
  useEffect(() => () => {
    unsubChat.current && unsubChat.current()
  }, [])

  // RENDER
  if (loadingRole) return <p className="loading">Loading Profile...</p>

  if (!role) {
    return (
      <div className="role-selection">
        <h2 className="role-title">Welcome!</h2>
        <h2>Please select your role:</h2>
        <div className="role-buttons">
          <button className="role-btn" onClick={() => handleSetRole("tenant")}>
            I am a Tenant
          </button>
          <button className="role-btn" onClick={() => handleSetRole("landlord")}>
            I am a Landlord
          </button>
        </div>
        <button className="btn btn-logout" onClick={() => signOut(auth)}>
          Log Out
        </button>
      </div>
    )
  }

  return (
    <div className="loggedin-container">
      {/* Header */}
      <div className="dashboard-header">
        <h2>Rent Assist</h2>
        <button className="btn btn-logout" onClick={() => signOut(auth)}>
          Log Out
        </button>
      </div>

      {/* User Info */}
      <div className="user-info">
        <img src={photoURL} alt="Profile Pic" className="user-avatar" />
        <div className="user-details">
          <h3>
            {displayNameInput || user.displayName || "User"}{" "}
            <span className="user-role">{role}</span>
          </h3>
          <p>{user.email}</p>
        </div>
      </div>

      {/* Display Name */}
      <div className="display-name-form">
        <h4 className="section-title">Display Name</h4>
        <div className="form-group">
          <input
          type="text"
          value={displayNameInput}
          onChange={e => setDisplayNameInput(e.target.value)}
          placeholder="Type display name..."
          className="form-input"
          />
          <button
            className="btn btn-primary"
            onClick={handleSaveDisplayName}
            disabled={savingDisplayName}
          >
            {savingDisplayName ? "Saving..." : "Save Display Name"}
          </button>
        </div>
      </div>

      {/* Rooms */}
      {role === "landlord" ? (
        <div className="rooms-section">
          <h4 className="section-title">Create Room</h4>
          <div className="form-group">
            <input
              type="text"
              placeholder="Name"
              value={newRoomName}
              onChange={e => setNewRoomName(e.target.value)}
              className="form-input"
            />
            <input
              type="text"
              placeholder="Password"
              value={newRoomPassword}
              onChange={e => setNewRoomPassword(e.target.value)}
              className="form-input"
            />
            <button className="btn btn-success" onClick={handleCreateRoom}>
              Create Room
            </button>
          </div>

          <h4 className="section-title">Your Rooms</h4>
          {loadingRooms ? (
            <p className="loading">Loading rooms...</p>
          ) : ownRooms.length === 0 ? (
            <p>No rooms yet</p>
          ) : (
            <div className="rooms-list">
              {ownRooms.map(r => (
                <div
                  key={r.id}
                  onClick={() => fetchAndSelectRoom(r.id)}
                  className={`room-item ${r.id === selectedRoom?.id ? "selected" : ""}`}
                >
                  <span>{r.name}</span>
                  <span>({r.members.length} tenants)</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="rooms-section tenant-view">
          <div className="rooms-div">
            <h4 className="section-title">Available Rooms</h4>
            <div className="search-container">
              <input 
                type="text" 
                placeholder="Search Rooms..." 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)}
                className="form-input"
              />
            </div>
            {loadingRooms ? (
              <p className="loading">Loading...</p>
            ) : rooms.length === 0 ? (
              <p>None yet</p>
            ) : (
              <div className="rooms-list">
                {rooms.filter(r => r.name.toLowerCase().includes(searchTerm.toLowerCase())).map(r => (
                  <div
                    key={r.id}
                    onClick={() => {
                      if (!r.members.includes(uid)) {
                        const pwd = prompt(`Password for "${r.name}"`);
                        if (pwd !== null) handleJoinRoom(r.id, pwd);
                      }
                    }}
                    className="room-item"
                  >
                    <span>{r.name}</span>
                    <span className={`room-status ${r.members.includes(uid) ? "joined" : "join"}`}>
                      {r.members.includes(uid) ? "Joined" : "Join"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="rooms-div">
            <h4 className="section-title">Joined Rooms</h4>
            {loadingRooms ? (
              <p className="loading">Loading...</p>
            ) : rooms.filter(r => r.members.includes(uid)).length === 0 ? (
              <p>No rooms joined yet</p>
            ) : (
              <div className="rooms-list">
                {rooms.filter(r => r.members.includes(uid)).map(r => (
                  <div
                    key={r.id}
                    onClick={() => fetchAndSelectRoom(r.id)}
                    className={`room-item ${r.id === selectedRoom?.id ? "selected" : ""}`}
                  >
                    {r.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Member List + Chat Trigger */}
      {selectedRoom && (
        <div className="room-details">
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <h2 style={{ fontSize: "25px" }}>{selectedRoom.name}</h2>
            <div>
              {role === "tenant" && (
                <button className="btn btn-danger" onClick={handleLeaveRoom}>
                  Leave Room
                </button>
              )}
              {role === "landlord" && (
                <button className="btn btn-danger" onClick={handleDeleteRoom}>
                  Delete Room
                </button>
              )}
            </div>
          </div>
          
          <h4 className="section-title">Members</h4>
          {loadingMembers ? (
            <p className="loading">Loading members...</p>
          ) : (
            <div className={role === "landlord" ? "member-list-landlord" : "member-list"}>
              {selectedRoomMembers
                .slice() // create a shallow copy to avoid mutating the original array
                .sort((a, b) => {
                  // If a is the current user, put it first
                  if (a.uid === uid) return -1;
                  if (b.uid === uid) return 1;
                  // If a is landlord, put it second
                  if (a.isLandlord) return -1;
                  if (b.isLandlord) return 1;
                  // otherwise, keep their original order
                  return 0;
                })
                .map(m => (
                  <div key={m.uid} className="member-item">
                    <div className="member-info">
                      <span className="member-name">{m.displayName}</span>
                      {m.isLandlord && <span className="member-role">Landlord</span>}
                      {m.uid === uid && <span className="member-role">You</span>}
                    </div>
                    <div>
                      {role === "landlord" && !m.isLandlord && (
                        <div style={{ display: "flex", gap: "10px" }}>
                          <button className="btn btn-danger" onClick={() => handleRemoveTenant(m.uid)}>
                            Remove
                          </button>
                          <button className="btn btn-primary" onClick={() => startChatWith(m)}>
                            Chat
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}

          {/* Chat Window */}
          {chatPeer && (
            <div className="chat-window">
              <h4 className="section-title">
                Chat with {chatPeer.displayName} {chatPeer.isLandlord && "(Landlord)"}
              </h4>
              <div className="chat-container">
                {messages.map(msg => (
                  <div 
                    key={msg.id} 
                    className={`message ${msg.senderId === uid ? "message-self" : "message-other"}`}
                  >
                    <div className="message-header">
                      <div className="message-sender">
                        {selectedRoomMembers.find(m => m.uid === msg.senderId)?.displayName || "Unknown"} 
                        {msg.senderId === uid && " (You)"}
                      </div>  
                      <div className="message-timestamp">{formatTimestamp(msg.timestamp)}</div>
                    </div>
                    <div className="message-text">{msg.text}</div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              <div className="chat-input-group">
                <input
                  type="text"
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  placeholder="Type a message…"
                  className="form-input"
                  onKeyDown={e => e.key === "Enter" && handleSendMessage()}
                />
                <button className="btn btn-primary" onClick={handleSendMessage}>
                  Send
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
