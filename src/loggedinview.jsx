import React from "react"
import { signOut } from "https://www.gstatic.com/firebasejs/10.1.0/firebase-auth.js"
import DefaultPic from "../assets/default.jpeg"

export default function LoggedInView({user, auth}) {
    const photoURL = user.photoURL ?? DefaultPic

    return (
        <div style={{display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem"}}>
            <h2>Logged In View</h2>
            <button onClick={() => signOut(auth)}>Log Out</button>
            <img src={photoURL} alt="Profile Pic" />
            <h3>Hey {user.displayName ?? "User"}, welcome!</h3>
            <p>You are logged in with: {user.email}</p>
        </div>
    )
}