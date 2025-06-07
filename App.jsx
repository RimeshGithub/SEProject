import React, { useState, useEffect } from "react"
import LoginPage from "./src/loginpage"
import LoggedInView from "./src/loggedinview"

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.1.0/firebase-app.js"
import { getAuth,
         onAuthStateChanged} from "https://www.gstatic.com/firebasejs/10.1.0/firebase-auth.js"


/* === Firebase Setup === */
const firebaseConfig = {
  apiKey: "AIzaSyD0APTZ6o07VF_AXNoFQSFLctlpMQkHkeQ",
  authDomain: "seproject2061.firebaseapp.com",
  projectId: "seproject2061",
  storageBucket: "seproject2061.firebasestorage.app",
  messagingSenderId: "84060211781",
  appId: "1:84060211781:web:5e57b53b67ee29da5e712c"
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
     return <LoggedInView user={user} auth={auth} app={app} />
    }

    return <LoginPage auth={auth} />
}
