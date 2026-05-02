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
          <div className="block text-sjblue text-2xl font-semibold leading-none md:text-3xl">
            <h1> SJ Project Manager </h1>
          </div>
          <div className="block ml-10 text-sjblue text-lg font-normal leading-tight md:text-xl">
            Real impact, <br /> made together 
          </div>
        </NavbarBrand>    
        <NavbarToggle />
        <NavbarCollapse>
          <NavbarLink as={Link} to="/" className="text-2xl font-semibold md:text-3xl">
            <h1> Update </h1>
          </NavbarLink>
          <NavbarLink as={Link} to="/Gantt" className="text-2xl font-semibold md:text-3xl">
            <h1> View </h1>
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