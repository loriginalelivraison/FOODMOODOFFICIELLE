import React from "react";
import { Link } from 'react-router-dom'
export default function NotFound() {
  return <section className="page centered-page"><h1>الصفحة غير موجودة</h1><Link className="primary-btn" to="/">العودة إلى الصفحة الرئيسية</Link></section>
}
