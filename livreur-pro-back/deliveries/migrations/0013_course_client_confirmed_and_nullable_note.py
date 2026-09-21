from django.db import migrations, models


def clear_unreviewed_notes(apps, schema_editor):
    Livreur = apps.get_model("deliveries", "Livreur")
    CommentaireLivreur = apps.get_model("deliveries", "CommentaireLivreur")

    reviewed_ids = CommentaireLivreur.objects.values_list("livreur_id", flat=True).distinct()
    Livreur.objects.exclude(id__in=reviewed_ids).update(note=None)


def keep_notes(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("deliveries", "0012_course_finished_by_client"),
    ]

    operations = [
        migrations.AlterField(
            model_name="livreur",
            name="note",
            field=models.FloatField(blank=True, default=None, null=True),
        ),
        migrations.AddField(
            model_name="course",
            name="client_confirmed",
            field=models.BooleanField(default=False),
        ),
        migrations.RunPython(clear_unreviewed_notes, keep_notes),
    ]
