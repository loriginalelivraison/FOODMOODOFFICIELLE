from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("deliveries", "0024_rename_livreur_brand_to_model")]

    operations = [
        migrations.AddField(
            model_name="courseoffer",
            name="offered_price",
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True),
        ),
    ]
