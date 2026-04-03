import { RouterProvider } from 'react-router';
import { ThemeProvider } from './contexts/ThemeContext';
import { DataProvider } from './contexts/DataContext';
import { UsageTimerProvider } from './contexts/UsageTimerContext';
import { GamesProvider } from './contexts/GamesContext';
import { router } from './routes';

export default function App() {
  return (
    <ThemeProvider>
      <DataProvider>
        <GamesProvider>
          <UsageTimerProvider>
            <RouterProvider router={router} />
          </UsageTimerProvider>
        </GamesProvider>
      </DataProvider>
    </ThemeProvider>
  );
}