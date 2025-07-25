"""Genesis baseline schema - complete database schema

Revision ID: 00000000
Revises: 
Create Date: 2025-07-25 12:00:00.000000

This is the baseline migration that creates the complete database schema
based on the production database state as of 2025-07-25.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel

# revision identifiers, used by Alembic.
revision: str = '00000000'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create complete database schema."""
    
    # Create opportunity table
    op.create_table('opportunity',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('opportunity_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('sfdc_url', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('account_name', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('opportunity_name', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('opportunity_type', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('tcv_millions', sa.Float(), nullable=True),
    sa.Column('margin_percentage', sa.Float(), nullable=True),
    sa.Column('first_year_q1_rev', sa.Float(), nullable=True),
    sa.Column('first_year_q2_rev', sa.Float(), nullable=True),
    sa.Column('first_year_q3_rev', sa.Float(), nullable=True),
    sa.Column('first_year_q4_rev', sa.Float(), nullable=True),
    sa.Column('first_year_fy_rev', sa.Float(), nullable=True),
    sa.Column('second_year_q1_rev', sa.Float(), nullable=True),
    sa.Column('second_year_q2_rev', sa.Float(), nullable=True),
    sa.Column('second_year_q3_rev', sa.Float(), nullable=True),
    sa.Column('second_year_q4_rev', sa.Float(), nullable=True),
    sa.Column('second_year_fy_rev', sa.Float(), nullable=True),
    sa.Column('fy_rev_beyond_yr2', sa.Float(), nullable=True),
    sa.Column('sales_stage', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('decision_date', sa.DateTime(), nullable=True),
    sa.Column('master_period', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('contract_length', sa.Float(), nullable=True),
    sa.Column('in_forecast', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('opportunity_owner', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('lead_offering_l1', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('ces_millions', sa.Float(), nullable=True),
    sa.Column('ins_millions', sa.Float(), nullable=True),
    sa.Column('bps_millions', sa.Float(), nullable=True),
    sa.Column('sec_millions', sa.Float(), nullable=True),
    sa.Column('itoc_millions', sa.Float(), nullable=True),
    sa.Column('mw_millions', sa.Float(), nullable=True),
    sa.Column('sales_org_l1', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('security_clearance', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('custom_priority', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('internal_stage_assessment', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('custom_tracking_field_1', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('custom_tracking_field_2', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('custom_tracking_field_3', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('internal_notes', sa.Text(), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_opportunity_opportunity_id', 'opportunity', ['opportunity_id'], unique=True)

    # Create opportunitylineitem table
    op.create_table('opportunitylineitem',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('opportunity_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('offering_tcv', sa.Float(), nullable=True),
    sa.Column('offering_abr', sa.Float(), nullable=True),
    sa.Column('offering_iyr', sa.Float(), nullable=True),
    sa.Column('offering_iqr', sa.Float(), nullable=True),
    sa.Column('offering_margin', sa.Float(), nullable=True),
    sa.Column('offering_margin_percentage', sa.Float(), nullable=True),
    sa.Column('decision_date', sa.DateTime(), nullable=True),
    sa.Column('master_period', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('lead_offering_l2', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('internal_service', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('simplified_offering', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('product_name', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('first_year_q1_rev', sa.Float(), nullable=True),
    sa.Column('first_year_q2_rev', sa.Float(), nullable=True),
    sa.Column('first_year_q3_rev', sa.Float(), nullable=True),
    sa.Column('first_year_q4_rev', sa.Float(), nullable=True),
    sa.Column('first_year_fy_rev', sa.Float(), nullable=True),
    sa.Column('second_year_q1_rev', sa.Float(), nullable=True),
    sa.Column('second_year_q2_rev', sa.Float(), nullable=True),
    sa.Column('second_year_q3_rev', sa.Float(), nullable=True),
    sa.Column('second_year_q4_rev', sa.Float(), nullable=True),
    sa.Column('second_year_fy_rev', sa.Float(), nullable=True),
    sa.Column('fy_rev_beyond_yr2', sa.Float(), nullable=True),
    sa.PrimaryKeyConstraint('id'),
    sa.ForeignKeyConstraint(['opportunity_id'], ['opportunity.opportunity_id'], )
    )

    # Create opportunity_resource_timeline table
    op.create_table('opportunity_resource_timeline',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('opportunity_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('service_line', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('stage_name', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('stage_start_date', sa.DateTime(), nullable=False),
    sa.Column('stage_end_date', sa.DateTime(), nullable=False),
    sa.Column('duration_weeks', sa.Float(), nullable=False),
    sa.Column('fte_required', sa.Float(), nullable=False),
    sa.Column('total_effort_weeks', sa.Float(), nullable=False),
    sa.Column('opportunity_name', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('category', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('tcv_millions', sa.Float(), nullable=True),
    sa.Column('decision_date', sa.DateTime(), nullable=False),
    sa.Column('calculated_date', sa.DateTime(), nullable=False),
    sa.Column('resource_status', sqlmodel.sql.sqltypes.AutoString(length=20), nullable=False, server_default='Predicted'),
    sa.Column('last_updated', sa.DateTime(), nullable=False, server_default='2025-01-01 00:00:00'),
    sa.Column('resource_category', sqlmodel.sql.sqltypes.AutoString(length=20), nullable=True),
    sa.PrimaryKeyConstraint('id'),
    sa.ForeignKeyConstraint(['opportunity_id'], ['opportunity.opportunity_id'], )
    )
    op.create_index('ix_opportunity_resource_timeline_category', 'opportunity_resource_timeline', ['category'], unique=False)
    op.create_index('ix_opportunity_resource_timeline_opportunity_id', 'opportunity_resource_timeline', ['opportunity_id'], unique=False)
    op.create_index('ix_opportunity_resource_timeline_service_line', 'opportunity_resource_timeline', ['service_line'], unique=False)
    op.create_index('ix_opportunity_resource_timeline_stage_end_date', 'opportunity_resource_timeline', ['stage_end_date'], unique=False)
    op.create_index('ix_opportunity_resource_timeline_stage_name', 'opportunity_resource_timeline', ['stage_name'], unique=False)
    op.create_index('ix_opportunity_resource_timeline_stage_start_date', 'opportunity_resource_timeline', ['stage_start_date'], unique=False)
    op.create_index('ix_opportunity_resource_timeline_last_updated', 'opportunity_resource_timeline', ['last_updated'], unique=False)
    op.create_index('ix_opportunity_resource_timeline_resource_category', 'opportunity_resource_timeline', ['resource_category'], unique=False)
    op.create_index('ix_opportunity_resource_timeline_resource_status', 'opportunity_resource_timeline', ['resource_status'], unique=False)

    # Create opportunitycategory table
    op.create_table('opportunitycategory',
    sa.Column('name', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('min_tcv', sa.Float(), nullable=False),
    sa.Column('max_tcv', sa.Float(), nullable=True),
    sa.Column('stage_01_duration_weeks', sa.Float(), nullable=False),
    sa.Column('stage_02_duration_weeks', sa.Float(), nullable=False),
    sa.Column('stage_03_duration_weeks', sa.Float(), nullable=False),
    sa.Column('stage_04a_duration_weeks', sa.Float(), nullable=False),
    sa.Column('stage_04b_duration_weeks', sa.Float(), nullable=False),
    sa.Column('stage_05a_duration_weeks', sa.Float(), nullable=False),
    sa.Column('stage_05b_duration_weeks', sa.Float(), nullable=False),
    sa.Column('stage_06_duration_weeks', sa.Float(), nullable=False),
    sa.Column('id', sa.Integer(), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )

    # Create servicelinecategory table
    op.create_table('servicelinecategory',
    sa.Column('service_line', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('name', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('min_tcv', sa.Float(), nullable=False),
    sa.Column('max_tcv', sa.Float(), nullable=True),
    sa.Column('id', sa.Integer(), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )

    # Create servicelinestageeffort table
    op.create_table('servicelinestageeffort',
    sa.Column('service_line', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('service_line_category_id', sa.Integer(), nullable=False),
    sa.Column('stage_name', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('fte_required', sa.Float(), nullable=False),
    sa.Column('id', sa.Integer(), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.ForeignKeyConstraint(['service_line_category_id'], ['servicelinecategory.id'], )
    )

    # Create servicelineofferingthreshold table
    op.create_table('servicelineofferingthreshold',
    sa.Column('service_line', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('stage_name', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('threshold_count', sa.Integer(), nullable=False),
    sa.Column('increment_multiplier', sa.Float(), nullable=False),
    sa.Column('id', sa.Integer(), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )

    # Create servicelineinternalservicemapping table
    op.create_table('servicelineinternalservicemapping',
    sa.Column('service_line', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('internal_service', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('id', sa.Integer(), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    """Drop all tables."""
    op.drop_table('servicelineinternalservicemapping')
    op.drop_table('servicelineofferingthreshold')
    op.drop_table('servicelinestageeffort')
    op.drop_table('servicelinecategory')
    op.drop_table('opportunitycategory')
    op.drop_index('ix_opportunity_resource_timeline_resource_status', table_name='opportunity_resource_timeline')
    op.drop_index('ix_opportunity_resource_timeline_resource_category', table_name='opportunity_resource_timeline')
    op.drop_index('ix_opportunity_resource_timeline_last_updated', table_name='opportunity_resource_timeline')
    op.drop_index('ix_opportunity_resource_timeline_stage_start_date', table_name='opportunity_resource_timeline')
    op.drop_index('ix_opportunity_resource_timeline_stage_name', table_name='opportunity_resource_timeline')
    op.drop_index('ix_opportunity_resource_timeline_stage_end_date', table_name='opportunity_resource_timeline')
    op.drop_index('ix_opportunity_resource_timeline_service_line', table_name='opportunity_resource_timeline')
    op.drop_index('ix_opportunity_resource_timeline_opportunity_id', table_name='opportunity_resource_timeline')
    op.drop_index('ix_opportunity_resource_timeline_category', table_name='opportunity_resource_timeline')
    op.drop_table('opportunity_resource_timeline')
    op.drop_table('opportunitylineitem')
    op.drop_index('ix_opportunity_opportunity_id', table_name='opportunity')
    op.drop_table('opportunity')