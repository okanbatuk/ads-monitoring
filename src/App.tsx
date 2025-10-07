import { RouterProvider } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeProvider';
import router from './router';
import './index.css';

function App() {
  return (
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>
  );
}

export default App;
