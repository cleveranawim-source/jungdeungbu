import { useEffect, useState } from 'react';
import { StudentApp } from '../student/StudentApp';
import { TeacherApp } from '../teacher/TeacherApp';
import { InvalidLink } from './InvalidLink';
import { Landing } from './Landing';
import { OfflineBar } from './OfflineBar';
import { parseHash, type Route } from './router';
import { ToastProvider } from './Toast';

function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseHash(location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export default function App() {
  const route = useRoute();
  return (
    <ToastProvider>
      <OfflineBar />
      {route.kind === 'landing' && <Landing />}
      {route.kind === 'student' && <StudentApp key={route.token} token={route.token} tab={route.tab} />}
      {route.kind === 'teacher' && <TeacherApp tab={route.tab} sub={route.sub} />}
      {route.kind === 'invalid' && <InvalidLink />}
    </ToastProvider>
  );
}
