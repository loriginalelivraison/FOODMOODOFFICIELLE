from django.db import migrations


def backfill_course_status(apps, schema_editor):
    Course = apps.get_model("deliveries", "Course")
    Course.objects.filter(active=True, livreur__isnull=False).update(status="driver_selected")
    Course.objects.filter(active=False, finished_at__isnull=False).update(status="completed")


class Migration(migrations.Migration):
    dependencies = [
        ("deliveries", "0015_course_request_key_course_route_geometry"),
    ]

    operations = [
        migrations.RunPython(backfill_course_status, migrations.RunPython.noop),
    ]