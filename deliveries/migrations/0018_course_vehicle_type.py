from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("deliveries", "0017_course_availability_before_course"),
    ]

    operations = [
        migrations.AddField(
            model_name="course",
            name="vehicle_type",
            field=models.CharField(
                choices=[("moto", "Moto"), ("voiture", "Voiture"), ("camion", "Camion")],
                default="voiture",
                max_length=20,
            ),
        ),
    ]