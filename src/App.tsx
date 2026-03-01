/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import Dashboard from './pages/Dashboard';
import BuildPlan from './pages/BuildPlan';
import RiskPassport from './pages/RiskPassport';
import ReceiptGallery from './pages/ReceiptGallery';
import ProtocolDirectory from './pages/ProtocolDirectory';
import ReceiptDetail from './pages/ReceiptDetail';
import PassportSnapshot from './pages/PassportSnapshot';

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/terminal/build" element={<BuildPlan />} />
          <Route path="/terminal/passport/:planId" element={<PassportSnapshot />} />
          <Route path="/terminal/passport" element={<RiskPassport />} />
          <Route path="/terminal/receipts" element={<ReceiptGallery />} />
          <Route path="/terminal/receipt/:receiptId" element={<ReceiptDetail />} />
          <Route path="/terminal/protocols" element={<ProtocolDirectory />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
