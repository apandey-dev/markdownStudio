import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import EditorPage from './pages/EditorPage';
import SharePage from './pages/SharePage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<EditorPage />} />
        <Route path="/share" element={<SharePage />} />
      </Routes>
    </Router>
  );
}

export default App;
