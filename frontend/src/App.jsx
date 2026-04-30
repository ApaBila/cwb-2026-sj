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
      <Navbar fluid rounded>
        <NavbarBrand>
          <span className="block text-2xl font-semibold leading-none md:text-3xl">
            <h1> SJ Project Updater </h1>
          </span>
          <span className="block ml-10 text-lg font-normal leading-tight md:text-xl">
            <body> Real impact, <br /> made together </body>
          </span>
        </NavbarBrand>    
        <NavbarToggle />
        <NavbarCollapse>
          <NavbarLink as={Link} to="/" className="text-2xl font-semibold md:text-3xl">
            <h1> Approve Update </h1>
          </NavbarLink>
          <NavbarLink as={Link} to="/Gantt" className="text-2xl font-semibold md:text-3xl">
            <h1> Gantt </h1>
          </NavbarLink>
        </NavbarCollapse>

      </Navbar>

      <Routes>
        <Route path="/" element={<ApproveUpdate />} />
        <Route path="/Gantt" element={<Gantt />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;