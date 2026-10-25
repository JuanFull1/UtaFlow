import Login from './pages/auth/Login.jsx'

import Authenticated from './pages/auth/Authenticated.jsx'
import { useAuth } from './context/AuthContext.js'

export default function App() {
  const { usuario } = useAuth()
  return usuario ? <Authenticated /> : <Login />
}
