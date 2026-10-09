from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("deliveries", "0022_client_fcm_token_driverdocument"),
    ]

    operations = [
        migrations.AddField(
            model_name="livreur",
            name="marque_vehicule",
            field=models.CharField(blank=True, default="", max_length=50),
        ),
    ]
