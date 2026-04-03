import { createBrowserRouter } from 'react-router';
import Welcome from './pages/Welcome';
import Dashboard from './pages/Dashboard';
import HabitTracker from './pages/HabitTracker';
import MoodTracker from './pages/MoodTracker';
import Games from './pages/Games';
import Suggestions from './pages/Suggestions';
import Analytics from './pages/Analytics';
import ExtensionPage from './pages/Extension';
import NotFound from './pages/NotFound';
import Layout from './components/Layout';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Welcome />,
  },
  {
    path: '/',
    element: <Layout />,
    children: [
      {
        path: 'dashboard',
        element: <Dashboard />,
      },
      {
        path: 'habits',
        element: <HabitTracker />,
      },
      {
        path: 'mood',
        element: <MoodTracker />,
      },
      {
        path: 'games',
        element: <Games />,
      },
      {
        path: 'suggestions',
        element: <Suggestions />,
      },
      {
        path: 'analytics',
        element: <Analytics />,
      },
      {
        path: 'extension',
        element: <ExtensionPage />,
      },
      {
        path: '*',
        element: <NotFound />,
      },
    ],
  },
]);