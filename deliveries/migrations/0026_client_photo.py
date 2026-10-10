from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("deliveries", "0025_courseoffer_offered_price"),
    ]

    operations = [
        migrations.AddField(
            model_name="client",
            name="photo",
            field=models.ImageField(blank=True, null=True, upload_to="clients/"),
        ),
    ]
