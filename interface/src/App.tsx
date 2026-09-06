import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { type AuthView, useSyncedPrivyAuth } from './hooks/useSyncedPrivyAuth';
import { LaunchHomePage } from './pages/LaunchHomePage';
import { MemeLaunchesPage } from './pages/MemeLaunchesPage';

type AppProps = {
  auth: AuthView;
};

export function PrivyConnectedApp() {
  const auth = useSyncedPrivyAuth();
  return <App auth={auth} />;
}

export function App({ auth }: AppProps) {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout auth={auth} />}>
          <Route path="/" element={<LaunchHomePage auth={auth} />} />
          <Route path="/memes" element={<MemeLaunchesPage auth={auth} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
