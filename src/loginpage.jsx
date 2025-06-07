import React, { useState } from "react"
import GoogleImg from "../assets/google.png"
import "../index.css";

import { createUserWithEmailAndPassword,
         signInWithEmailAndPassword,
         GoogleAuthProvider,
         signInWithPopup } from "https://www.gstatic.com/firebasejs/10.1.0/firebase-auth.js"

const provider = new GoogleAuthProvider()

export default function LoginPage({auth}) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  function authSignInWithGoogle() {
    signInWithPopup(auth, provider)
        .then((result) => {
            console.log("Signed in with Google")
        }).catch((error) => {
            console.error(error.message)
            alert(error.message)
        })
  }

  function authSignInWithEmail() {
    signInWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            clearAuthFields()
        })
        .catch((error) => {
            console.error(error.message)
            alert(error.message)
        })
  }

  function authCreateAccountWithEmail() {
    createUserWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            clearAuthFields()
        })
        .catch((error) => {
            console.error(error.message) 
            alert(error.message)
        })
  }

  function clearAuthFields() {
    setEmail("")
    setPassword("")
  }

  return (
    <div className="login-container">
      <div className="login-form-wrapper">
        <h2 className="login-title">Rent Assist</h2>
        <form className="login-form">
          <input
            type="email"
            className="login-input"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            className="login-input"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button className="login-btn" type="button" onClick={authSignInWithEmail}>
            Login
          </button>
          <button className="login-btn" type="button" onClick={authCreateAccountWithEmail}>
            Create Account
          </button>
        </form>
        <div className="login-divider">or</div>
        <button className="google-btn" onClick={authSignInWithGoogle}>
          <img src={GoogleImg} alt="Google" style={{ width: "20px" }} />
          Sign in with Google
        </button>
      </div>
    </div>
  )
}
