import { useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Navbar, NavbarCollapse, NavbarLink, NavbarToggle } from 'flowbite-react';
import './App.css';
import ApproveUpdate from './ApproveUpdate';
import Gantt from './Gantt';

//https://reactrouter.com/6.30.3/components/routes#routes
//https://flowbite-react.com/docs/components/navbar#default-navbar
//https://reactrouter.com/6.30.3/components/link#link

function AppShell() {
  const { pathname } = useLocation();
  const outletScrollRef = useRef(null);
  const navLinkClass = (path) =>
    pathname === path ? 'font-semibold text-sjblue' : 'font-semibold';

  useEffect(() => {
    outletScrollRef.current?.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="flex h-svh min-h-0 w-full min-w-0 flex-col overflow-hidden">
      <Navbar fluid className="relative flex w-full shrink-0 items-center justify-between rounded-none border-0 bg-white shadow-none">
        <NavbarToggle />
        <NavbarCollapse>
          <NavbarLink
            as={Link}
            to="/"
            active={pathname === '/'}
            className={navLinkClass('/')}
          >
            <h1> Get In → </h1>
          </NavbarLink>
          <h1 className="font-bold text-sjblue text-center"> The <br /> Loop </h1>
          <NavbarLink
            as={Link}
            to="/Gantt"
            active={pathname === '/Gantt'}
            className={navLinkClass('/Gantt')}
          >
            <h1> ← Stay In </h1>
          </NavbarLink>
        </NavbarCollapse>
      </Navbar>

      <div
        ref={outletScrollRef}
        className="flex min-h-0 min-w-0 w-full max-w-full flex-1 flex-col overflow-x-hidden overflow-y-auto"
      >
        <Routes>
          <Route path="/" element={<ApproveUpdate />} />
          <Route path="/Gantt" element={<Gantt />} />
        </Routes>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}

export default App;