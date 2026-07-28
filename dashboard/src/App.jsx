import Dashboard from "./pages/Dashboard.jsx"
import PrivacyPolicy from "./pages/PrivacyPolicy.jsx"

export default function App() {
  if (window.location.pathname === "/privacy") {
    return <PrivacyPolicy />
  }

  return <Dashboard />
}
