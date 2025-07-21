"""drop_existing_tables_and_create_new_schema_from_excel

Revision ID: e4fb9acd6a5e
Revises: faaa88ccf45c
Create Date: 2025-07-21 18:59:24.888521

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e4fb9acd6a5e'
down_revision: Union[str, Sequence[str], None] = 'faaa88ccf45c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Drop existing tables and create new schema based on Excel files."""
    
    # Drop existing tables (in order to avoid foreign key constraints)
    op.drop_table('quarterlyrevenue')
    op.drop_table('opportunitylineitem')
    op.drop_table('opportunity')
    
    # Create new opportunity table based on Opportunities.xlsx
    op.create_table(
        'opportunity',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('opportunity_id', sa.String(), nullable=False, unique=True, index=True),
        sa.Column('sfdc_url', sa.String(), nullable=True),
        sa.Column('account_name', sa.String(), nullable=True),
        sa.Column('opportunity_name', sa.String(), nullable=False),
        sa.Column('opportunity_type', sa.String(), nullable=True),
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
        sa.Column('sales_stage', sa.String(), nullable=True),
        sa.Column('decision_date', sa.DateTime(), nullable=True),
        sa.Column('master_period', sa.String(), nullable=True),
        sa.Column('contract_length', sa.Float(), nullable=True),
        sa.Column('in_forecast', sa.String(), nullable=True),
        sa.Column('opportunity_owner', sa.String(), nullable=True),
        sa.Column('lead_offering_l1', sa.String(), nullable=True),
        sa.Column('ces_millions', sa.Float(), nullable=True),
        sa.Column('ins_millions', sa.Float(), nullable=True),
        sa.Column('bps_millions', sa.Float(), nullable=True),
        sa.Column('sec_millions', sa.Float(), nullable=True),
        sa.Column('itoc_millions', sa.Float(), nullable=True),
        sa.Column('mw_millions', sa.Float(), nullable=True),
        sa.Column('sales_org_l1', sa.String(), nullable=True),
    )
    
    # Create new opportunity line item table based on Opportunities Items.xlsx columns G-AC
    op.create_table(
        'opportunitylineitem',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('opportunity_id', sa.String(), nullable=False),
        sa.Column('offering_tcv', sa.Float(), nullable=True),
        sa.Column('offering_abr', sa.Float(), nullable=True),
        sa.Column('offering_iyr', sa.Float(), nullable=True),
        sa.Column('offering_iqr', sa.Float(), nullable=True),
        sa.Column('offering_margin', sa.Float(), nullable=True),
        sa.Column('offering_margin_percentage', sa.Float(), nullable=True),
        sa.Column('decision_date', sa.DateTime(), nullable=True),
        sa.Column('master_period', sa.String(), nullable=True),
        sa.Column('lead_offering_l2', sa.String(), nullable=True),
        sa.Column('internal_service', sa.String(), nullable=True),
        sa.Column('simplified_offering', sa.String(), nullable=True),
        sa.Column('product_name', sa.String(), nullable=True),
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
        sa.ForeignKeyConstraint(['opportunity_id'], ['opportunity.opportunity_id'], ),
    )


def downgrade() -> None:
    """Downgrade schema - recreate original tables."""
    # This would recreate the original tables, but since we're completely 
    # changing the schema, downgrade is not practically useful
    pass
