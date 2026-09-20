from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("deliveries", "0011_course_finished_by"),
    ]

    operations = [
        migrations.AddField(
            model_name="course",
            name="finished_by_client",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="courses_finies",
                to="deliveries.client",
            ),
        ),
    ]