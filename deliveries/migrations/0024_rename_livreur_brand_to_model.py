from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("deliveries", "0023_livreur_vehicle_brand"),
    ]

    operations = [
        migrations.RenameField(
            model_name="livreur",
            old_name="marque_vehicule",
            new_name="modele_vehicule",
        ),
    ]
