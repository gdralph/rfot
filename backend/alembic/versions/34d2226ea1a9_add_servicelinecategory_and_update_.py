"""Add ServiceLineCategory and update ServiceLineStageEffort

Revision ID: 34d2226ea1a9
Revises: 983b4275b32f
Create Date: 2025-07-23 11:26:05.416397

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = '34d2226ea1a9'
down_revision: Union[str, Sequence[str], None] = '983b4275b32f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema with data migration."""
    # Create the new servicelinecategory table
    op.create_table('servicelinecategory',
        sa.Column('service_line', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('min_tcv', sa.Float(), nullable=False),
        sa.Column('max_tcv', sa.Float(), nullable=True),
        sa.Column('id', sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create temporary service_line_category_id column that allows NULL
    op.add_column('servicelinestageeffort', 
        sa.Column('service_line_category_id', sa.Integer(), nullable=True))
    
    # Get connection for data migration
    connection = op.get_bind()
    
    # Get existing opportunity categories
    result = connection.execute(sa.text("SELECT id, name, min_tcv, max_tcv FROM opportunitycategory"))
    opp_categories = result.fetchall()
    
    # Create service line categories for MW and ITOC based on existing opportunity categories
    sl_category_mapping = {}  # (service_line, opp_category_id) -> sl_category_id
    
    for opp_cat in opp_categories:
        # Create for MW
        mw_result = connection.execute(
            sa.text("""
                INSERT INTO servicelinecategory (service_line, name, min_tcv, max_tcv) 
                VALUES (:service_line, :name, :min_tcv, :max_tcv)
            """),
            {"service_line": "MW", "name": opp_cat[1], "min_tcv": opp_cat[2], "max_tcv": opp_cat[3]}
        )
        mw_id = mw_result.lastrowid
        sl_category_mapping[("MW", opp_cat[0])] = mw_id
        
        # Create for ITOC
        itoc_result = connection.execute(
            sa.text("""
                INSERT INTO servicelinecategory (service_line, name, min_tcv, max_tcv) 
                VALUES (:service_line, :name, :min_tcv, :max_tcv)
            """),
            {"service_line": "ITOC", "name": opp_cat[1], "min_tcv": opp_cat[2], "max_tcv": opp_cat[3]}
        )
        itoc_id = itoc_result.lastrowid
        sl_category_mapping[("ITOC", opp_cat[0])] = itoc_id
    
    # Update existing ServiceLineStageEffort records
    efforts = connection.execute(
        sa.text("SELECT id, service_line, category_id FROM servicelinestageeffort")
    ).fetchall()
    
    for effort in efforts:
        sl_cat_id = sl_category_mapping.get((effort[1], effort[2]))
        if sl_cat_id:
            connection.execute(
                sa.text("""
                    UPDATE servicelinestageeffort 
                    SET service_line_category_id = :sl_cat_id 
                    WHERE id = :id
                """),
                {"sl_cat_id": sl_cat_id, "id": effort[0]}
            )
    
    # Now make service_line_category_id NOT NULL
    # For SQLite, we need to recreate the table
    op.create_table('servicelinestageeffort_new',
        sa.Column('service_line', sa.String(), nullable=False),
        sa.Column('service_line_category_id', sa.Integer(), nullable=False),
        sa.Column('stage_name', sa.String(), nullable=False),
        sa.Column('duration_weeks', sa.Float(), nullable=False),
        sa.Column('fte_required', sa.Float(), nullable=False),
        sa.Column('id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['service_line_category_id'], ['servicelinecategory.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Copy data from old table to new table
    connection.execute(sa.text("""
        INSERT INTO servicelinestageeffort_new (id, service_line, service_line_category_id, stage_name, duration_weeks, fte_required)
        SELECT id, service_line, service_line_category_id, stage_name, duration_weeks, fte_required
        FROM servicelinestageeffort
    """))
    
    # Drop old table and rename new table
    op.drop_table('servicelinestageeffort')
    op.rename_table('servicelinestageeffort_new', 'servicelinestageeffort')
    
    # Skip altering opportunity.internal_notes for SQLite
    # op.alter_column('opportunity', 'internal_notes',
    #            existing_type=sa.TEXT(),
    #            type_=sa.String(),
    #            existing_nullable=True)


def downgrade() -> None:
    """Downgrade schema - restore original structure."""
    # Create temporary table with old structure
    op.create_table('servicelinestageeffort_old',
        sa.Column('service_line', sa.String(), nullable=False),
        sa.Column('category_id', sa.Integer(), nullable=False),
        sa.Column('stage_name', sa.String(), nullable=False),
        sa.Column('duration_weeks', sa.Float(), nullable=False),
        sa.Column('fte_required', sa.Float(), nullable=False),
        sa.Column('id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['category_id'], ['opportunitycategory.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Get connection for data migration
    connection = op.get_bind()
    
    # Map service line categories back to opportunity categories
    result = connection.execute(sa.text("""
        SELECT slc.id, slc.service_line, slc.name, oc.id as opp_cat_id
        FROM servicelinecategory slc
        JOIN opportunitycategory oc ON slc.name = oc.name
    """))
    mappings = {row[0]: row[3] for row in result}
    
    # Copy data back with mapped category_id
    efforts = connection.execute(sa.text("""
        SELECT id, service_line, service_line_category_id, stage_name, duration_weeks, fte_required
        FROM servicelinestageeffort
    """)).fetchall()
    
    for effort in efforts:
        opp_cat_id = mappings.get(effort[2], 1)  # Default to 1 if not found
        connection.execute(sa.text("""
            INSERT INTO servicelinestageeffort_old (id, service_line, category_id, stage_name, duration_weeks, fte_required)
            VALUES (:id, :service_line, :category_id, :stage_name, :duration_weeks, :fte_required)
        """), {
            "id": effort[0],
            "service_line": effort[1],
            "category_id": opp_cat_id,
            "stage_name": effort[3],
            "duration_weeks": effort[4],
            "fte_required": effort[5]
        })
    
    # Drop new table and rename old table
    op.drop_table('servicelinestageeffort')
    op.rename_table('servicelinestageeffort_old', 'servicelinestageeffort')
    
    # Drop servicelinecategory table
    op.drop_table('servicelinecategory')