import React, { useState, useEffect } from "react"
import LoginPage from "./src/loginpage"
import LoggedInView from "./src/loggedinview"

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.1.0/firebase-app.js"
import { getAuth,
         onAuthStateChanged} from "https://www.gstatic.com/firebasejs/10.1.0/firebase-auth.js"


/* === Firebase Setup === */
const firebaseConfig = {
  apiKey: "AIzaSyC3JfDWRpFegL2xV5_vUmE5p_0YRrNWoU4",
  authDomain: "fir-project-e955e.firebaseapp.com",
  databaseURL: "https://fir-project-e955e-default-rtdb.firebaseio.com",
  projectId: "fir-project-e955e",
  storageBucket: "fir-project-e955e.appspot.com",
  messagingSenderId: "67657787043",
  appId: "1:67657787043:web:ea8982f313ffd57e910116"
}

const app = initializeApp(firebaseConfig)
const auth = getAuth(app)

export default function App() {
    const [user, setUser] = useState(null)
    const [loggedIn, setLoggedIn] = useState(false)

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
        setUser(user)
        setLoggedIn(user !== null)
        })
        return () => unsubscribe()
    }, [])

    if (loggedIn) {
     return <LoggedInView user={user} auth={auth} />
    }

    return <LoginPage auth={auth} />
}
