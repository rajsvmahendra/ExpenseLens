import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import ImportDashboard from './pages/ImportDashboard';
import AuditCenter from './pages/AuditCenter';
import Expenses from './pages/Expenses';
import ExplainBalance from './pages/ExplainBalance';
import Groups from './pages/Groups';
import DecisionTrail from './pages/DecisionTrail';

export default function App() {
  return (
    <Router>
      <Routes>
        {/* Auth Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Dashboard Shell Routes */}
        <Route 
          path="/" 
          element={
            <Layout>
              <Dashboard />
            </Layout>
          } 
        />
        <Route 
          path="/import" 
          element={
            <Layout>
              <ImportDashboard />
            </Layout>
          } 
        />
        <Route 
          path="/audit" 
          element={
            <Layout>
              <AuditCenter />
            </Layout>
          } 
        />
        <Route 
          path="/expenses" 
          element={
            <Layout>
              <Expenses />
            </Layout>
          } 
        />
        <Route 
          path="/explain-balance" 
          element={
            <Layout>
              <ExplainBalance />
            </Layout>
          } 
        />
        <Route 
          path="/groups" 
          element={
            <Layout>
              <Groups />
            </Layout>
          } 
        />
        <Route 
          path="/decisions" 
          element={
            <Layout>
              <DecisionTrail />
            </Layout>
          } 
        />
      </Routes>
    </Router>
  );
}

