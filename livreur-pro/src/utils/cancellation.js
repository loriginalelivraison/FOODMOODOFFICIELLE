export function cancellationMessage(cancelledBy, isDriver) {
  if (cancelledBy === "livreur" && !isDriver) {
    return "نعتذر، ألغى السائق الرحلة. يمكنك طلب سائق آخر.";
  }
  if (cancelledBy === "client" && isDriver) {
    return "ألغى العميل الطلب. يمكنك استقبال طلبات جديدة.";
  }
  return "تم إلغاء طلبك. سنعيدك إلى الرئيسية.";
}
