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
          SJ Project Updater  <br /> 
          Real impact, <br /> made together
        </NavbarBrand>    
        <NavbarToggle />
        <NavbarCollapse>
          <NavbarLink as={Link} to="/">
            Approve Update
          </NavbarLink>
          <NavbarLink as={Link} to="/Gantt">
            Gantt
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