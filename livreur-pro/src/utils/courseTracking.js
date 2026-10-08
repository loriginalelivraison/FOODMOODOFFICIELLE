export function isDeliveryVehicle(vehicleType) {
  return ["moto", "camion"].includes(vehicleType);
}

export function getCourseSteps(vehicleType) {
  return isDeliveryVehicle(vehicleType)
    ? ["الطلب", "عامل التوصيل", "الاستلام", "التوصيل", "تم التسليم"]
    : ["الطلب", "السائق", "الانطلاق", "الرحلة", "انتهت"];
}

export function getCourseStepIndex(status) {
  if (status === "searching") return 0;
  if (["driver_accepted", "driver_selected"].includes(status)) return 1;
  if (["driver_arriving", "driver_arrived"].includes(status)) return 2;
  if (["picked_up", "in_progress"].includes(status)) return 3;
  return status === "completed" ? 4 : -1;
}

function position(latitude, longitude) {
  return latitude != null && longitude != null
    && latitude !== "" && longitude !== ""
    && Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude))
    ? { latitude: Number(latitude), longitude: Number(longitude) } : null;
}

export function getPickupPosition(course) {
  return position(course.pickup_latitude, course.pickup_longitude)
    || position(course.client_latitude, course.client_longitude);
}

export function getDestinationPosition(course) {
  return position(course.destination_latitude, course.destination_longitude)
    || (!course.destination ? position(course.client_latitude, course.client_longitude) : null);
}

export function isDropoffStage(status) {
  return ["picked_up", "in_progress"].includes(status);
}

export function getCourseTarget(course) {
  if (["completed", "cancelled"].includes(course.status)) return null;
  return isDropoffStage(course.status) ? getDestinationPosition(course) : getPickupPosition(course);
}

export function canFinishCourse(course) {
  if (!course.active || !course.livreur) return false;
  if (course.status === "in_progress") return true;
  // Compatibilité des anciennes demandes sans destination.
  return !course.destination && ["driver_selected", "driver_arriving", "driver_arrived", "picked_up"].includes(course.status);
}

export function getCourseStatusLabel(course) {
  const delivery = isDeliveryVehicle(course.vehicle_type);
  const labels = {
    searching: delivery ? "جارٍ البحث عن عامل توصيل" : "جارٍ البحث عن سائق",
    driver_accepted: "في انتظار اختيار العميل",
    driver_selected: delivery ? "تم تأكيد عامل التوصيل" : "تم تأكيد السائق",
    driver_arriving: delivery ? "في الطريق إلى نقطة الاستلام" : "في الطريق إلى نقطة الانطلاق",
    driver_arrived: delivery ? "وصل إلى نقطة الاستلام" : "وصل إلى نقطة الانطلاق",
    picked_up: delivery ? "تم استلام الطلب" : "جاهز لبدء الرحلة",
    in_progress: delivery ? "الطلب في الطريق إلى نقطة التسليم" : "الرحلة جارية",
    completed: delivery ? "تم تسليم الطلب" : "اكتملت الرحلة",
    cancelled: delivery ? "تم إلغاء الطلب" : "تم إلغاء الرحلة",
  };
  return labels[course.status] || "الرحلة نشطة";
}

export function getDriverCourseHint(course) {
  const delivery = isDeliveryVehicle(course.vehicle_type);
  if (["driver_selected", "driver_arriving"].includes(course.status)) {
    return delivery ? "توجه إلى نقطة الاستلام لاستلام الطلب." : "توجه إلى نقطة الانطلاق لاستقبال الراكب.";
  }
  if (course.status === "driver_arrived") {
    return delivery ? "بعد استلام الطلب، اضغط على «تم استلام الطلب»." : "بعد صعود الراكب، اضغط على «بدء الرحلة».";
  }
  if (course.status === "picked_up") {
    return delivery ? "اضغط على «بدء التوصيل» ثم توجه إلى نقطة التسليم." : "اضغط على «بدء الرحلة» للمتابعة.";
  }
  return delivery ? "توجه إلى نقطة التسليم، ثم أكّد تسليم الطلب." : "توجه إلى الوجهة، ثم أنهِ الرحلة عند الوصول.";
}
