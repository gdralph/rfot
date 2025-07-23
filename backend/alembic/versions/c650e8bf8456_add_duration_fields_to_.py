"""Add duration fields to OpportunityCategory and remove from ServiceLineStageEffort

Revision ID: c650e8bf8456
Revises: 34d2226ea1a9
Create Date: 2025-07-23 12:12:16.635088

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c650e8bf8456'
down_revision: Union[str, Sequence[str], None] = '34d2226ea1a9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - move durations from ServiceLineStageEffort to OpportunityCategory."""
    
    # For SQLite, we need to create a new table and copy data
    # Create new OpportunityCategory table with duration fields
    op.create_table('opportunitycategory_new',
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('min_tcv', sa.Float(), nullable=False),
        sa.Column('max_tcv', sa.Float(), nullable=True),
        sa.Column('stage_01_duration_weeks', sa.Float(), nullable=False, default=0.0),
        sa.Column('stage_02_duration_weeks', sa.Float(), nullable=False, default=0.0),
        sa.Column('stage_03_duration_weeks', sa.Float(), nullable=False, default=0.0),
        sa.Column('stage_04a_duration_weeks', sa.Float(), nullable=False, default=0.0),
        sa.Column('stage_04b_duration_weeks', sa.Float(), nullable=False, default=0.0),
        sa.Column('stage_05a_duration_weeks', sa.Float(), nullable=False, default=0.0),
        sa.Column('stage_05b_duration_weeks', sa.Float(), nullable=False, default=0.0),
        sa.Column('stage_06_duration_weeks', sa.Float(), nullable=False, default=0.0),
        sa.Column('id', sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Get connection for data migration
    connection = op.get_bind()
    
    # Copy existing OpportunityCategory data to new table with default durations
    connection.execute(sa.text("""
        INSERT INTO opportunitycategory_new (id, name, min_tcv, max_tcv, 
            stage_01_duration_weeks, stage_02_duration_weeks, stage_03_duration_weeks,
            stage_04a_duration_weeks, stage_04b_duration_weeks, stage_05a_duration_weeks,
            stage_05b_duration_weeks, stage_06_duration_weeks)
        SELECT id, name, min_tcv, max_tcv, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0
        FROM opportunitycategory
    """))
    
    # Get existing duration data from ServiceLineStageEffort
    # We'll take the MW service line durations as the baseline since durations should be consistent
    mw_durations = connection.execute(sa.text("""
        SELECT slse.stage_name, slse.duration_weeks, slc.name as category_name
        FROM servicelinestageeffort slse
        JOIN servicelinecategory slc ON slse.service_line_category_id = slc.id
        WHERE slse.service_line = 'MW'
    """)).fetchall()
    
    # Group by category
    category_durations = {}
    for row in mw_durations:
        stage_name, duration_weeks, category_name = row
        if category_name not in category_durations:
            category_durations[category_name] = {}
        category_durations[category_name][stage_name] = duration_weeks
    
    # Update OpportunityCategory records with duration data
    for category_name, durations in category_durations.items():
        updates = {}
        for stage_name, duration_weeks in durations.items():
            # Map stage names to column names
            column_mapping = {
                '01': 'stage_01_duration_weeks',
                '02': 'stage_02_duration_weeks', 
                '03': 'stage_03_duration_weeks',
                '04A': 'stage_04a_duration_weeks',
                '04B': 'stage_04b_duration_weeks',
                '05A': 'stage_05a_duration_weeks',
                '05B': 'stage_05b_duration_weeks',
                '06': 'stage_06_duration_weeks'
            }
            
            if stage_name in column_mapping:
                updates[column_mapping[stage_name]] = duration_weeks
        
        # Build UPDATE query for new table
        if updates:
            set_clause = ', '.join([f"{col} = :{col}" for col in updates.keys()])
            query = f"UPDATE opportunitycategory_new SET {set_clause} WHERE name = :category_name"
            connection.execute(sa.text(query), {**updates, 'category_name': category_name})
    
    # Drop old table and rename new table
    op.drop_table('opportunitycategory')
    op.rename_table('opportunitycategory_new', 'opportunitycategory')
    
    # Create new ServiceLineStageEffort table without duration_weeks column
    op.create_table('servicelinestageeffort_new',
        sa.Column('service_line', sa.String(), nullable=False),
        sa.Column('service_line_category_id', sa.Integer(), nullable=False),
        sa.Column('stage_name', sa.String(), nullable=False),
        sa.Column('fte_required', sa.Float(), nullable=False),
        sa.Column('id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['service_line_category_id'], ['servicelinecategory.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Copy data from old table to new table (excluding duration_weeks)
    connection.execute(sa.text("""
        INSERT INTO servicelinestageeffort_new (id, service_line, service_line_category_id, stage_name, fte_required)
        SELECT id, service_line, service_line_category_id, stage_name, fte_required
        FROM servicelinestageeffort
    """))
    
    # Drop old table and rename new table
    op.drop_table('servicelinestageeffort')
    op.rename_table('servicelinestageeffort_new', 'servicelinestageeffort')


def downgrade() -> None:
    """Downgrade schema - move durations back from OpportunityCategory to ServiceLineStageEffort."""
    
    # Create ServiceLineStageEffort table with duration_weeks column
    op.create_table('servicelinestageeffort_old',
        sa.Column('service_line', sa.String(), nullable=False),
        sa.Column('service_line_category_id', sa.Integer(), nullable=False),
        sa.Column('stage_name', sa.String(), nullable=False),
        sa.Column('duration_weeks', sa.Float(), nullable=False),
        sa.Column('fte_required', sa.Float(), nullable=False),
        sa.Column('id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['service_line_category_id'], ['servicelinecategory.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Get connection for data migration
    connection = op.get_bind()
    
    # Get opportunity categories with their durations
    categories = connection.execute(sa.text("""
        SELECT name, stage_01_duration_weeks, stage_02_duration_weeks, stage_03_duration_weeks,
               stage_04a_duration_weeks, stage_04b_duration_weeks, stage_05a_duration_weeks,
               stage_05b_duration_weeks, stage_06_duration_weeks
        FROM opportunitycategory
    """)).fetchall()
    
    # Build duration lookup
    category_durations = {}
    for row in categories:
        name = row[0]
        category_durations[name] = {
            '01': row[1],
            '02': row[2],
            '03': row[3],
            '04A': row[4],
            '04B': row[5],
            '05A': row[6],
            '05B': row[7],
            '06': row[8]
        }
    
    # Copy data from current ServiceLineStageEffort and add duration data
    efforts = connection.execute(sa.text("""
        SELECT slse.id, slse.service_line, slse.service_line_category_id, slse.stage_name, slse.fte_required, slc.name
        FROM servicelinestageeffort slse
        JOIN servicelinecategory slc ON slse.service_line_category_id = slc.id
    """)).fetchall()
    
    for effort in efforts:
        effort_id, service_line, service_line_category_id, stage_name, fte_required, category_name = effort
        duration_weeks = category_durations.get(category_name, {}).get(stage_name, 0.0)
        
        connection.execute(sa.text("""
            INSERT INTO servicelinestageeffort_old (id, service_line, service_line_category_id, stage_name, duration_weeks, fte_required)
            VALUES (:id, :service_line, :service_line_category_id, :stage_name, :duration_weeks, :fte_required)
        """), {
            "id": effort_id,
            "service_line": service_line,
            "service_line_category_id": service_line_category_id,
            "stage_name": stage_name,
            "duration_weeks": duration_weeks,
            "fte_required": fte_required
        })
    
    # Drop new table and rename old table
    op.drop_table('servicelinestageeffort')
    op.rename_table('servicelinestageeffort_old', 'servicelinestageeffort')
    
    # Remove duration columns from OpportunityCategory
    op.drop_column('opportunitycategory', 'stage_06_duration_weeks')
    op.drop_column('opportunitycategory', 'stage_05b_duration_weeks')
    op.drop_column('opportunitycategory', 'stage_05a_duration_weeks')
    op.drop_column('opportunitycategory', 'stage_04b_duration_weeks')
    op.drop_column('opportunitycategory', 'stage_04a_duration_weeks')
    op.drop_column('opportunitycategory', 'stage_03_duration_weeks')
    op.drop_column('opportunitycategory', 'stage_02_duration_weeks')
    op.drop_column('opportunitycategory', 'stage_01_duration_weeks')
