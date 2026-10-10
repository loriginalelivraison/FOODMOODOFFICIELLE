from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("deliveries", "0028_coursecomplaint"),
    ]

    operations = [
        migrations.AddField(
            model_name="course",
            name="purchase_details",
            field=models.TextField(blank=True),
        ),
    ]
