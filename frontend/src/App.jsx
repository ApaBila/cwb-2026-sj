import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { Navbar, NavbarBrand, NavbarCollapse, NavbarLink, NavbarToggle } from 'flowbite-react';
import './App.css';
import ApproveUpdate from './ApproveUpdate';
import Gantt from './Gantt';

//https://reactrouter.com/6.30.3/components/routes#routes
//https://flowbite-react.com/docs/components/navbar#default-navbar
//https://reactrouter.com/6.30.3/components/link#link

function App() {
  return (
    <BrowserRouter>
      <div className="flex h-svh min-h-0 w-full min-w-0 flex-col overflow-hidden">
      <Navbar fluid className="shrink-0 rounded-none bg-white shadow-none">
        <NavbarBrand>
          <div className="block text-sjblue font-bold leading-none">
            <h1> SJ Project Manager </h1>
          </div>
          <div className="block ml-5 text-sjblue text-base font-bold leading-tight">
            Real impact, <br /> made together 
          </div>
        </NavbarBrand>    
        <NavbarToggle />
        <NavbarCollapse>
          <NavbarLink as={Link} to="/" className="font-semibold">
            <h1> Update </h1>
          </NavbarLink>
          <NavbarLink as={Link} to="/Gantt" className="font-semibold">
            <h1> View </h1>
          </NavbarLink>
        </NavbarCollapse>

      </Navbar>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto">
        <Routes>
          <Route path="/" element={<ApproveUpdate />} />
          <Route path="/Gantt" element={<Gantt />} />
        </Routes>
      </div>
      </div>
    </BrowserRouter>
  );
}

export default App;