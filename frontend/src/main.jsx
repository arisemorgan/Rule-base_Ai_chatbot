import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './styles.css'
class Boundary extends React.Component {
  state = { e: null }
  static getDerivedStateFromError(e) { return { e } }
  render() { return this.state.e ? <div className="center"><div className="card" style={{ maxWidth: 560 }}><h3 className="gold">Something went wrong</h3><div className="err">{String(this.state.e.message || this.state.e)}</div><a href="/">Back to home</a></div></div> : this.props.children }
}
createRoot(document.getElementById('root')).render(<Boundary><BrowserRouter><App /></BrowserRouter></Boundary>)