import { RouterProvider } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeProvider';
import { AccountTreeProvider } from './context/AccountTreeContext';
import router from './router';
import './index.css';

function App() {
  return (
    <ThemeProvider>
      <AccountTreeProvider>
        <RouterProvider router={router} />
      </AccountTreeProvider>
    </ThemeProvider>
  );
}

export default App;
