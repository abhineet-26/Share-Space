from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import migration_session_factory
from app.models import (
    AcademicGroup,
    Asset,
    AssetStatus,
    AvailabilityWindow,
    Booking,
    BookingStatus,
    ConditionLevel,
    ConditionReport,
    Incident,
    IncidentComment,
    IncidentStatus,
    LedgerEntityType,
    LedgerEvent,
    Notification,
    NotificationType,
    Organization,
    OutboxEvent,
    OutboxStatus,
    Policy,
    PolicyKind,
    PolicyScopeType,
    PolicyStatus,
    PolicyVersion,
    RequirementType,
    Resource,
    ResourceCategory,
    ResourceRequirement,
    ResourceStatus,
    Role,
    SupervisionLevel,
    TrainingRecord,
    TrainingStatus,
    User,
    VerificationStatus,
)
from app.services.ledger import append_ledger_event, verify_ledger_chain


async def seed_database(session: AsyncSession) -> None:
    print("Clearing existing data...")
    # Temporarily disable ledger immutability trigger for database reset
    await session.execute(
        text("ALTER TABLE ledgerevent DISABLE TRIGGER trg_protect_ledger_events;")
    )
    # Delete in reverse foreign key order
    await session.execute(delete(LedgerEvent))
    await session.execute(delete(IncidentComment))
    await session.execute(delete(Incident))
    await session.execute(delete(ConditionReport))
    await session.execute(delete(Booking))
    await session.execute(delete(Asset))
    await session.execute(delete(AvailabilityWindow))
    await session.execute(delete(ResourceRequirement))
    await session.execute(delete(Resource))
    await session.execute(delete(PolicyVersion))
    await session.execute(delete(Policy))
    await session.execute(delete(TrainingRecord))
    await session.execute(delete(Notification))
    await session.execute(delete(OutboxEvent))
    await session.execute(delete(User))
    await session.execute(delete(Organization))
    # Re-enable ledger immutability trigger
    await session.execute(
        text("ALTER TABLE ledgerevent ENABLE TRIGGER trg_protect_ledger_events;")
    )
    # Flush deletions
    await session.flush()

    now = datetime.now(UTC)

    print("Seeding organizations...")
    org_nit = Organization(
        id="org_nit",
        name="Nilgiri Institute of Technology",
        domain="nit.edu.in",
        department_code="NIT-CAMPUS-OPS",
        timezone="Asia/Kolkata",
        retention_days=365,
    )
    org_harbour = Organization(
        id="org_harbour",
        name="Harbour Community Makerspace",
        domain="harbourmakers.org",
        department_code="HCM-FABLAB",
        timezone="Asia/Kolkata",
        retention_days=180,
    )
    session.add_all([org_nit, org_harbour])
    await session.flush()

    print("Seeding users...")
    users_data = [
        User(
            id="usr_aarav",
            organization_id="org_nit",
            name="Aarav Menon",
            email="aarav.menon@nit.edu.in",
            roles=[Role.USER],
            department="Electrical & Electronics Engineering",
            academic_group=AcademicGroup.UNDERGRAD_CAPSTONE,
            verification=VerificationStatus.VERIFIED,
            demo_persona_note="Student — Electronics induction COMPLETED, 3D-printer safety COMPLETED",
        ),
        User(
            id="usr_diya",
            organization_id="org_nit",
            name="Diya Rao",
            email="diya.rao@nit.edu.in",
            roles=[Role.USER],
            department="Mechanical & Product Design",
            academic_group=AcademicGroup.COURSEWORK,
            verification=VerificationStatus.VERIFIED,
            demo_persona_note="Student — Electronics induction COMPLETED, 3D-printer safety NOT completed",
        ),
        User(
            id="usr_kabir",
            organization_id="org_nit",
            name="Kabir Shah",
            email="kabir.shah@nit.edu.in",
            roles=[Role.USER],
            department="Media Arts & Embedded Systems",
            academic_group=AcademicGroup.COURSEWORK,
            verification=VerificationStatus.VERIFIED,
            demo_persona_note="Heavy user — Near weekly usage cap on Camera Kit and 3D Printer",
        ),
        User(
            id="usr_meera",
            organization_id="org_nit",
            name="Dr. Meera Iyer",
            email="meera.iyer@nit.edu.in",
            roles=[Role.OWNER, Role.USER],
            department="Electronics Department",
            academic_group=AcademicGroup.STAFF,
            verification=VerificationStatus.VERIFIED,
            demo_persona_note="Resource Owner — Controls Electronics Department labs and instruments",
        ),
        User(
            id="usr_ravi",
            organization_id="org_nit",
            name="Ravi Kulkarni",
            email="ravi.kulkarni@nit.edu.in",
            roles=[Role.MANAGER, Role.USER],
            department="Central Technical Operations",
            academic_group=AcademicGroup.STAFF,
            verification=VerificationStatus.VERIFIED,
            demo_persona_note="Lab Manager — Reviews requests, confirms handovers/returns, resolves incidents",
        ),
        User(
            id="usr_priya",
            organization_id="org_nit",
            name="Priya Nair",
            email="priya.nair@nit.edu.in",
            roles=[Role.ADMIN, Role.OWNER, Role.MANAGER, Role.USER],
            department="Institutional Governance & Safety",
            academic_group=AcademicGroup.STAFF,
            verification=VerificationStatus.VERIFIED,
            demo_persona_note="Administrator — Manages versioned policies and ledger oversight",
        ),
        User(
            id="usr_rohan",
            organization_id="org_harbour",
            name="Rohan Deshmukh",
            email="rohan@harbourmakers.org",
            roles=[Role.ADMIN, Role.OWNER, Role.MANAGER, Role.USER],
            department="Harbour Operations",
            academic_group=AcademicGroup.COMMUNITY,
            verification=VerificationStatus.VERIFIED,
            demo_persona_note="Harbour Community Admin — Demonstrates complete cross-tenant isolation",
        ),
    ]
    session.add_all(users_data)
    await session.flush()

    print("Seeding training records...")
    trainings = [
        TrainingRecord(
            id="trn_aarav_elec",
            user_id="usr_aarav",
            organization_id="org_nit",
            type="ELEC_SAFETY_101",
            label="Electronics Lab General Induction",
            status=TrainingStatus.VERIFIED,
            source="NIT Central Workshop Portal #NIT-2026-ELEC-4821",
            verified_by="usr_meera",
            expires_at=now + timedelta(days=280),
        ),
        TrainingRecord(
            id="trn_aarav_3d",
            user_id="usr_aarav",
            organization_id="org_nit",
            type="3D_PRINTER_CERT",
            label="Additive Manufacturing & FDM Safety",
            status=TrainingStatus.VERIFIED,
            source="Makerspace LMS #FDM-8820",
            verified_by="usr_ravi",
            expires_at=now + timedelta(days=190),
        ),
        TrainingRecord(
            id="trn_diya_elec",
            user_id="usr_diya",
            organization_id="org_nit",
            type="ELEC_SAFETY_101",
            label="Electronics Lab General Induction",
            status=TrainingStatus.VERIFIED,
            source="NIT Central Workshop Portal #NIT-2026-ELEC-5112",
            verified_by="usr_meera",
            expires_at=now + timedelta(days=310),
        ),
        TrainingRecord(
            id="trn_diya_3d",
            user_id="usr_diya",
            organization_id="org_nit",
            type="3D_PRINTER_CERT",
            label="Additive Manufacturing & FDM Safety",
            status=TrainingStatus.NONE,
            source="Not completed — practical assessment required",
        ),
        TrainingRecord(
            id="trn_kabir_elec",
            user_id="usr_kabir",
            organization_id="org_nit",
            type="ELEC_SAFETY_101",
            label="Electronics Lab General Induction",
            status=TrainingStatus.VERIFIED,
            source="NIT Central Workshop Portal #NIT-2026-ELEC-3918",
            verified_by="usr_meera",
            expires_at=now + timedelta(days=150),
        ),
        TrainingRecord(
            id="trn_kabir_3d",
            user_id="usr_kabir",
            organization_id="org_nit",
            type="3D_PRINTER_CERT",
            label="Additive Manufacturing & FDM Safety",
            status=TrainingStatus.VERIFIED,
            source="Makerspace LMS #FDM-7140",
            verified_by="usr_ravi",
            expires_at=now + timedelta(days=220),
        ),
        TrainingRecord(
            id="trn_rohan_laser",
            user_id="usr_rohan",
            organization_id="org_harbour",
            type="LASER_CUTTER_CERT",
            label="Laser Cutter Level 2 Safety",
            status=TrainingStatus.VERIFIED,
            source="Harbour Makers Induction #HBM-2026-001",
            verified_by="usr_rohan",
            expires_at=now + timedelta(days=365),
        ),
    ]
    session.add_all(trainings)
    await session.flush()

    print("Seeding policies and versions...")
    policy_elec = Policy(
        id="pol_nit_elec_general",
        organization_id="org_nit",
        name="Electronics Department General Safety & Eligibility",
        description="Mandatory workshop induction and staff confirmation for high-voltage testing.",
        scope_type=PolicyScopeType.CATEGORY,
        scope_id="ELECTRONICS",
        scope_label="Electronics Category",
        kind=PolicyKind.ELIGIBILITY,
        status=PolicyStatus.ACTIVE,
        active_version=1,
    )
    pv_elec = PolicyVersion(
        id="polv_nit_elec_v1",
        organization_id="org_nit",
        policy_id="pol_nit_elec_general",
        version=1,
        definition={
            "rules": [
                {
                    "checkKey": "TRAINING_ELEC_INDUCTION",
                    "type": "TRAINING",
                    "requiredTraining": "ELEC_SAFETY_101",
                    "label": "Electronics Lab General Induction",
                    "blocking": True,
                }
            ],
            "maxDurationHours": 8,
            "minLeadTimeHours": 1,
            "maxAdvanceDays": 14,
        },
        effective_from=now - timedelta(days=60),
        created_by="usr_priya",
        created_by_name="Priya Nair",
        reason="Initial campus safety governance policy baseline",
    )

    policy_cap = Policy(
        id="pol_nit_high_demand_cap",
        organization_id="org_nit",
        name="High Demand Equipment Rolling Usage Cap",
        description="Prevents single-user monopolisation of camera kits, 3D printers, and GPU nodes.",
        scope_type=PolicyScopeType.ORG,
        scope_id="org_nit",
        scope_label="Nilgiri Institute of Technology",
        kind=PolicyKind.USAGE_CAP,
        status=PolicyStatus.ACTIVE,
        active_version=1,
    )
    pv_cap = PolicyVersion(
        id="polv_nit_cap_v1",
        organization_id="org_nit",
        policy_id="pol_nit_high_demand_cap",
        version=1,
        definition={
            "rollingWindowDays": 7,
            "maxHoursPerWindow": 6.0,
            "applicableResourceIds": ["res_3dprint", "res_camera", "res_gpu"],
            "allowWaitlistWhenNearCap": True,
        },
        effective_from=now - timedelta(days=45),
        created_by="usr_priya",
        created_by_name="Priya Nair",
        reason="Approved by Dean of Student Affairs for fair allocation during semester projects",
    )

    session.add_all([policy_elec, pv_elec, policy_cap, pv_cap])
    await session.flush()

    print("Seeding resources...")
    resources = [
        Resource(
            id="res_scope",
            organization_id="org_nit",
            owner_id="usr_meera",
            owner_name="Dr. Meera Iyer",
            department="Electrical & Electronics Engineering",
            name="Keysight InfiniiVision 100MHz Digital Oscilloscope",
            model_number="DSOX1204G",
            category=ResourceCategory.ELECTRONICS,
            illustration_type="OSCILLOSCOPE",
            location="Lab 302, Signal Processing Wing",
            access_instructions="Collect key from Dr. Meera or Lab Tech Ravi in Room 301.",
            description="4-channel 100MHz digital storage oscilloscope with built-in waveform generator.",
            condition=ConditionLevel.EXCELLENT,
            status=ResourceStatus.PUBLISHED,
            supervision=SupervisionLevel.NONE,
            accessories=["Passive Probes x4", "Power Cord", "BNC-to-Alligator Lead"],
            usage_rules="Handle probes with care. Ground clips must be attached to verified ground.",
            return_rules="Ensure probes are neatly coiled and channel covers replaced.",
            cancellation_policy="Cancel at least 2 hours before start window.",
            policy_ids=["pol_nit_elec_general"],
        ),
        Resource(
            id="res_3dprint",
            organization_id="org_nit",
            owner_id="usr_ravi",
            owner_name="Ravi Kulkarni",
            department="Central Technical Operations",
            name="UltiMaker S5 Dual-Extrusion 3D Printer",
            model_number="UM-S5-PRO",
            category=ResourceCategory.MEDIA_COMPUTING,
            illustration_type="3D_PRINTER",
            location="Innovation Makerspace, Ground Floor Bay 2",
            access_instructions="Sign in at Makerspace desk. Show student ID and 3D certification.",
            description="Professional dual extrusion FDM printer with heated bed and composite material support.",
            condition=ConditionLevel.GOOD,
            status=ResourceStatus.PUBLISHED,
            supervision=SupervisionLevel.STAFF_CONFIRMATION,
            accessories=["Glass Build Plate", "Nozzle Cleaning Kit", "Material Spool Holder"],
            usage_rules="Slicing profiles must use certified Cura defaults. Monitor initial 3 layers in person.",
            return_rules="Remove printed parts after bed cools to under 40C. Scrape bed cleanly.",
            cancellation_policy="Late cancellation under 1 hour incurs usage cap decrement.",
            policy_ids=["pol_nit_high_demand_cap"],
        ),
        Resource(
            id="res_camera",
            organization_id="org_nit",
            owner_id="usr_ravi",
            owner_name="Ravi Kulkarni",
            department="Media Arts & Embedded Systems",
            name="Sony Alpha A7 IV Mirrorless Camera Kit",
            model_number="ILCE-7M4K",
            category=ResourceCategory.MEDIA_COMPUTING,
            illustration_type="CAMERA",
            location="Media Equipment Locker, Room 114",
            access_instructions="Locker code issued 15 minutes before confirmed start time.",
            description="Full-frame 33MP hybrid camera with 28-70mm lens, dual batteries, and 128GB SD card.",
            condition=ConditionLevel.EXCELLENT,
            status=ResourceStatus.PUBLISHED,
            supervision=SupervisionLevel.STAFF_CONFIRMATION,
            accessories=["Body Cap", "28-70mm Zoom Lens", "NP-FZ100 Batteries x2", "Dual Charger", "128GB V90 SD Card", "Padded Carry Bag"],
            usage_rules="Store in carry case when moving. Never leave unattended in open labs.",
            return_rules="Return all batteries charged. Ensure lens elements are free of fingerprints.",
            cancellation_policy="Requires 4 hours advance cancellation to free kit for peers.",
            policy_ids=["pol_nit_high_demand_cap"],
        ),
        Resource(
            id="res_soldering",
            organization_id="org_nit",
            owner_id="usr_meera",
            owner_name="Dr. Meera Iyer",
            department="Electrical & Electronics Engineering",
            name="Weller WT1010 ESD Soldering Station",
            model_number="WT1010N",
            category=ResourceCategory.ELECTRONICS,
            illustration_type="SOLDERING_STATION",
            location="Lab 302, Bench 04",
            access_instructions="Open access during lab hours (9 AM - 6 PM) for certified students.",
            description="Precision ESD-safe temperature controlled soldering iron with fume extraction duct.",
            condition=ConditionLevel.GOOD,
            status=ResourceStatus.PUBLISHED,
            supervision=SupervisionLevel.NONE,
            accessories=["Chisel Tip 2.4mm", "Conical Tip 0.8mm", "Brass Sponge", "ESD Ground Cord"],
            usage_rules="Always turn off power unit when leaving bench. Wear safety goggles.",
            return_rules="Clean tip with brass wool and tin tip with fresh solder before switching off.",
            cancellation_policy="Flexible cancellation.",
            policy_ids=["pol_nit_elec_general"],
        ),
        Resource(
            id="res_psu",
            organization_id="org_nit",
            owner_id="usr_meera",
            owner_name="Dr. Meera Iyer",
            department="Electrical & Electronics Engineering",
            name="Rigol DP832 Triple Output Programmable Power Supply",
            model_number="DP832A",
            category=ResourceCategory.ELECTRONICS,
            illustration_type="POWER_SUPPLY",
            location="Lab 302, Bench 02",
            access_instructions="Available for academic project work. Verify current limits before enabling output.",
            description="3 channels, 195W total power: CH1 30V/3A, CH2 30V/3A, CH3 5V/3A.",
            condition=ConditionLevel.EXCELLENT,
            status=ResourceStatus.PUBLISHED,
            supervision=SupervisionLevel.NONE,
            accessories=["Banana-to-Alligator Cables x3", "Banana-to-Minigrabber Cable", "AC Power Cable"],
            usage_rules="Set over-voltage and over-current protection limits before connecting DUT.",
            return_rules="Disconnect all output leads and power down.",
            cancellation_policy="Flexible cancellation.",
            policy_ids=["pol_nit_elec_general"],
        ),
        Resource(
            id="res_dmm",
            organization_id="org_nit",
            owner_id="usr_meera",
            owner_name="Dr. Meera Iyer",
            department="Electrical & Electronics Engineering",
            name="Fluke 87V Industrial Digital Multimeter Kit",
            model_number="FLUKE-87-5",
            category=ResourceCategory.ELECTRONICS,
            illustration_type="MULTIMETER",
            location="Lab 302, Cabinet A",
            access_instructions="Available for checkout during lab sessions.",
            description="True-RMS multimeter with temperature probe and silicone test leads.",
            condition=ConditionLevel.EXCELLENT,
            status=ResourceStatus.PUBLISHED,
            supervision=SupervisionLevel.NONE,
            accessories=["TL75 Test Leads", "AC175 Alligator Clips", "80BK Temperature Probe", "Holster"],
            usage_rules="Never exceed rated input voltages.",
            return_rules="Turn selector dial to OFF position.",
            cancellation_policy="Flexible cancellation.",
            policy_ids=["pol_nit_elec_general"],
        ),
        Resource(
            id="res_tripod",
            organization_id="org_nit",
            owner_id="usr_ravi",
            owner_name="Ravi Kulkarni",
            department="Media Arts & Embedded Systems",
            name="Manfrotto Professional Video Tripod & LED Bi-Color Panel",
            model_number="MVH502A-546BK-1",
            category=ResourceCategory.MEDIA_COMPUTING,
            illustration_type="TRIPOD",
            location="Media Equipment Locker, Room 114",
            access_instructions="Collect from locker along with camera kit or independently.",
            description="Fluid video head with twin-leg aluminum tripod plus Godox bi-color LED video light.",
            condition=ConditionLevel.GOOD,
            status=ResourceStatus.PUBLISHED,
            supervision=SupervisionLevel.NONE,
            accessories=["Quick Release Plate", "Tripod Bag", "Godox LED Light Panel", "Light Stand", "AC Adapter"],
            usage_rules="Tighten pan/tilt locks before moving.",
            return_rules="Collapse legs and pack in padded carrying case.",
            cancellation_policy="Flexible cancellation.",
            policy_ids=[],
        ),
        Resource(
            id="res_gpu",
            organization_id="org_nit",
            owner_id="usr_ravi",
            owner_name="Ravi Kulkarni",
            department="Central Technical Operations",
            name="Deep Learning Workstation (Dual RTX 4090 48GB VRAM)",
            model_number="NIT-GPU-NODE-03",
            category=ResourceCategory.MEDIA_COMPUTING,
            illustration_type="GPU_WORKSTATION",
            location="Server Room Annex, Terminal 03",
            access_instructions="SSH credentials provisioned upon booking approval.",
            description="Dedicated compute node: AMD Threadripper Pro, 128GB RAM, 2x NVIDIA RTX 4090 GPUs.",
            condition=ConditionLevel.EXCELLENT,
            status=ResourceStatus.PUBLISHED,
            supervision=SupervisionLevel.NONE,
            accessories=["SSH Keypair Access", "JupyterLab Port Forwarding"],
            usage_rules="No cryptocurrency mining. Heavy training scripts must log to designated scratch disk.",
            return_rules="Clean up temporary checkpoint files and terminate running docker containers.",
            cancellation_policy="Cancel at least 6 hours in advance.",
            policy_ids=["pol_nit_high_demand_cap"],
        ),
        Resource(
            id="res_room204",
            organization_id="org_nit",
            owner_id="usr_priya",
            owner_name="Priya Nair",
            department="Institutional Governance & Safety",
            name="Collaborative Project Room 204 (Seats 8)",
            model_number="BLDG2-RM204",
            category=ResourceCategory.SPACE,
            illustration_type="PROJECT_ROOM",
            location="Academic Block 2, Second Floor Room 204",
            access_instructions="Smart lock pin sent via SMS/notification 30 minutes before booking.",
            description="Sound-damped project sprint room with 65-inch 4K presentation display and mobile whiteboard.",
            condition=ConditionLevel.EXCELLENT,
            status=ResourceStatus.PUBLISHED,
            supervision=SupervisionLevel.NONE,
            accessories=["HDMI Cable", "USB-C Display Hub", "Whiteboard Marker Set x4", "Smart TV Remote"],
            usage_rules="Keep room door closed. Maximum capacity 8 persons.",
            return_rules="Wipe whiteboard clean. Return chairs to conference configuration.",
            cancellation_policy="Cancel 2 hours before booking start.",
            policy_ids=[],
        ),
        Resource(
            id="res_meeting_b",
            organization_id="org_nit",
            owner_id="usr_priya",
            owner_name="Priya Nair",
            department="Institutional Governance & Safety",
            name="Design Review Meeting Room B (Seats 14)",
            model_number="BLDG1-RMB",
            category=ResourceCategory.SPACE,
            illustration_type="MEETING_ROOM",
            location="Administration Complex, West Wing Ground Floor",
            access_instructions="Keycard access. Receptionist verifies confirmed booking.",
            description="Formal board-style meeting room equipped with Polycom conference audio and ceiling mic array.",
            condition=ConditionLevel.EXCELLENT,
            status=ResourceStatus.PUBLISHED,
            supervision=SupervisionLevel.NONE,
            accessories=["Conference Mic Array", "HDMI Extension", "Polycom Touch Console"],
            usage_rules="No outside hot food permitted. Keep noise to standard meeting levels.",
            return_rules="Switch off display and conference system upon departure.",
            cancellation_policy="Cancel 4 hours in advance.",
            policy_ids=[],
        ),
        Resource(
            id="res_harbour_laser",
            organization_id="org_harbour",
            owner_id="usr_rohan",
            owner_name="Rohan Deshmukh",
            department="Harbour Operations",
            name="Epilog Fusion Pro 48 CO2 Laser Cutter (80W)",
            model_number="EP-FP48-80",
            category=ResourceCategory.ELECTRONICS,
            illustration_type="LASER_CUTTER",
            location="Harbour Makerspace Bay 1",
            access_instructions="Supervised access only. Must have Level 2 certification.",
            description="80W CO2 laser cutting and engraving system for acrylic, wood, and leather.",
            condition=ConditionLevel.EXCELLENT,
            status=ResourceStatus.PUBLISHED,
            supervision=SupervisionLevel.STAFF_PRESENT,
            accessories=["Rotary Attachment", "Honeycomb Cutting Table", "Fume Extraction Unit"],
            usage_rules="Never cut PVC or halogenated materials. Constant visual supervision required while cutting.",
            return_rules="Clear scrap bin beneath honeycomb bed.",
            cancellation_policy="Cancel at least 24 hours in advance.",
            policy_ids=[],
        ),
    ]
    session.add_all(resources)
    await session.flush()

    print("Seeding resource requirements...")
    requirements = [
        ResourceRequirement(
            resource_id="res_scope",
            key="TRAINING_ELEC_INDUCTION",
            type=RequirementType.TRAINING,
            label="Electronics Lab General Induction",
            value="ELEC_SAFETY_101",
        ),
        ResourceRequirement(
            resource_id="res_soldering",
            key="TRAINING_ELEC_INDUCTION",
            type=RequirementType.TRAINING,
            label="Electronics Lab General Induction",
            value="ELEC_SAFETY_101",
        ),
        ResourceRequirement(
            resource_id="res_3dprint",
            key="TRAINING_3D_CERT",
            type=RequirementType.TRAINING,
            label="Additive Manufacturing & FDM Safety",
            value="3D_PRINTER_CERT",
        ),
        ResourceRequirement(
            resource_id="res_harbour_laser",
            key="TRAINING_LASER_CERT",
            type=RequirementType.TRAINING,
            label="Laser Cutter Level 2 Safety",
            value="LASER_CUTTER_CERT",
        ),
    ]
    session.add_all(requirements)

    print("Seeding availability windows...")
    windows = [
        AvailabilityWindow(resource_id="res_scope", day_of_week="ALL", start="08:00", end="20:00"),
        AvailabilityWindow(resource_id="res_3dprint", day_of_week="WEEKDAY", start="09:00", end="18:00"),
        AvailabilityWindow(resource_id="res_camera", day_of_week="ALL", start="07:00", end="21:00"),
        AvailabilityWindow(resource_id="res_soldering", day_of_week="WEEKDAY", start="09:00", end="18:00"),
        AvailabilityWindow(resource_id="res_psu", day_of_week="ALL", start="08:00", end="20:00"),
        AvailabilityWindow(resource_id="res_dmm", day_of_week="ALL", start="08:00", end="20:00"),
        AvailabilityWindow(resource_id="res_tripod", day_of_week="ALL", start="07:00", end="21:00"),
        AvailabilityWindow(resource_id="res_gpu", day_of_week="ALL", start="00:00", end="23:59"),
        AvailabilityWindow(resource_id="res_room204", day_of_week="ALL", start="08:00", end="22:00"),
        AvailabilityWindow(resource_id="res_meeting_b", day_of_week="WEEKDAY", start="09:00", end="19:00"),
        AvailabilityWindow(resource_id="res_harbour_laser", day_of_week="WEEKDAY", start="10:00", end="19:00"),
    ]
    session.add_all(windows)

    print("Seeding assets with unguessable QR tokens...")
    assets = [
        Asset(
            id="ast_scope_01",
            organization_id="org_nit",
            resource_id="res_scope",
            asset_tag="NIT-EE-DSO-01",
            serial_number="MY61290124",
            qr_token="qr_sec_dso_8f7b2a9e4c1d",
            condition=ConditionLevel.EXCELLENT,
            status=AssetStatus.AVAILABLE,
            last_calibrated_at=now - timedelta(days=90),
        ),
        Asset(
            id="ast_3dprint_01",
            organization_id="org_nit",
            resource_id="res_3dprint",
            asset_tag="NIT-MKR-FDM-01",
            serial_number="UM-S5-88401",
            qr_token="qr_sec_fdm_3e91a0b5c87f",
            condition=ConditionLevel.GOOD,
            status=AssetStatus.AVAILABLE,
            last_calibrated_at=now - timedelta(days=30),
        ),
        Asset(
            id="ast_camera_01",
            organization_id="org_nit",
            resource_id="res_camera",
            asset_tag="NIT-MDA-CAM-01",
            serial_number="SN-7M4-338901",
            qr_token="qr_sec_cam_7a1c9e2b4f6d",
            condition=ConditionLevel.EXCELLENT,
            status=AssetStatus.AVAILABLE,
            last_calibrated_at=now - timedelta(days=15),
        ),
        Asset(
            id="ast_harbour_laser_01",
            organization_id="org_harbour",
            resource_id="res_harbour_laser",
            asset_tag="HBM-BAY1-LZR-01",
            serial_number="EP-48-99201",
            qr_token="qr_sec_lzr_5f8a1c3d9e2b",
            condition=ConditionLevel.EXCELLENT,
            status=AssetStatus.AVAILABLE,
            last_calibrated_at=now - timedelta(days=20),
        ),
    ]
    session.add_all(assets)
    await session.flush()

    print("Seeding bookings across lifecycle states...")
    bookings = [
        # 1. Aarav's upcoming confirmed booking on Oscilloscope (APPROVED)
        Booking(
            id="bkg_aarav_scope_approved",
            organization_id="org_nit",
            resource_id="res_scope",
            user_id="usr_aarav",
            start_at=now + timedelta(hours=2),
            end_at=now + timedelta(hours=5),
            purpose="Senior Capstone: Switch-mode power supply transient response analysis",
            project_code="CAPSTONE-EEE-2026",
            team_members=["Aarav Menon", "Pooja Hegde"],
            status=BookingStatus.APPROVED,
            idempotency_key="idemp_aarav_scope_001",
            policy_version_ids=["polv_nit_elec_v1"],
            eligibility_checks=[
                {
                    "checkKey": "TRAINING_ELEC_INDUCTION",
                    "label": "Electronics Lab General Induction",
                    "status": "PASS",
                    "reason": "Training ELEC_SAFETY_101 verified and active until Nov 2026",
                    "blocking": True,
                }
            ],
            decision_reason="Approved for capstone testing during scheduled lab supervisor hours.",
            decided_by="usr_meera",
            decided_at=now - timedelta(hours=4),
        ),
        # 2. Aarav's active checked-out booking on Multimeter (CHECKED_OUT_TO_USER)
        Booking(
            id="bkg_aarav_dmm_active",
            organization_id="org_nit",
            resource_id="res_dmm",
            user_id="usr_aarav",
            start_at=now - timedelta(hours=1),
            end_at=now + timedelta(hours=2),
            purpose="Bench testing voltage drop across shunt resistors",
            project_code="CAPSTONE-EEE-2026",
            status=BookingStatus.CHECKED_OUT_TO_USER,
            idempotency_key="idemp_aarav_dmm_002",
            policy_version_ids=["polv_nit_elec_v1"],
            eligibility_checks=[
                {"checkKey": "TRAINING_ELEC_INDUCTION", "label": "Electronics Lab Induction", "status": "PASS", "reason": "Verified", "blocking": True}
            ],
            decision_reason="Approved standard checkout.",
            decided_by="usr_meera",
            decided_at=now - timedelta(hours=2),
        ),
        # 3. Kabir's booking pending return confirmation on Soldering Station (RETURN_PENDING_CONFIRMATION)
        Booking(
            id="bkg_kabir_solder_return_pending",
            organization_id="org_nit",
            resource_id="res_soldering",
            user_id="usr_kabir",
            start_at=now - timedelta(hours=3),
            end_at=now - timedelta(minutes=15),
            purpose="Soldering sensor breakout boards for IoT weather station",
            project_code="IOT-MEDIA-501",
            status=BookingStatus.RETURN_PENDING_CONFIRMATION,
            idempotency_key="idemp_kabir_solder_003",
            policy_version_ids=["polv_nit_elec_v1"],
            eligibility_checks=[
                {"checkKey": "TRAINING_ELEC_INDUCTION", "label": "Electronics Lab Induction", "status": "PASS", "reason": "Verified", "blocking": True}
            ],
            decision_reason="Auto-approved under open lab hours policy.",
            decided_by="usr_meera",
            decided_at=now - timedelta(hours=4),
        ),
        # 4. Diya's waitlisted booking on Camera Kit (WAITLISTED)
        Booking(
            id="bkg_diya_camera_waitlist",
            organization_id="org_nit",
            resource_id="res_camera",
            user_id="usr_diya",
            start_at=now + timedelta(days=1, hours=2),
            end_at=now + timedelta(days=1, hours=5),
            purpose="Documenting ergonomic chair prototype scale model",
            project_code="DES-MECH-404",
            status=BookingStatus.WAITLISTED,
            idempotency_key="idemp_diya_cam_004",
            policy_version_ids=["polv_nit_cap_v1"],
            waitlist_position=1,
            waitlist_reason="Slot currently held by higher priority capstone team; candidate promoted automatically if released.",
            eligibility_checks=[
                {"checkKey": "VERIFICATION_STATUS", "label": "Student Verification", "status": "PASS", "reason": "Active enrolled student", "blocking": True}
            ],
        ),
        # 5. Kabir's rejected request with mandatory reason (REJECTED)
        Booking(
            id="bkg_kabir_gpu_rejected",
            organization_id="org_nit",
            resource_id="res_gpu",
            user_id="usr_kabir",
            start_at=now + timedelta(days=2),
            end_at=now + timedelta(days=2, hours=8),
            purpose="Personal rendering experiment (non-coursework)",
            status=BookingStatus.REJECTED,
            idempotency_key="idemp_kabir_gpu_005",
            policy_version_ids=["polv_nit_cap_v1"],
            decision_reason="GPU Node resources are strictly prioritized for approved academic coursework and faculty research during finals week.",
            decided_by="usr_ravi",
            decided_at=now - timedelta(hours=6),
            eligibility_checks=[
                {"checkKey": "ACADEMIC_PURPOSE", "label": "Academic Project Justification", "status": "FAIL", "reason": "Requires faculty-approved course/capstone code", "blocking": True}
            ],
        ),
        # 6. Past completed and closed booking with condition reports (CLOSED)
        Booking(
            id="bkg_aarav_psu_closed",
            organization_id="org_nit",
            resource_id="res_psu",
            user_id="usr_aarav",
            start_at=now - timedelta(days=2, hours=4),
            end_at=now - timedelta(days=2, hours=1),
            purpose="Testing 5V regulated buck converter efficiency",
            project_code="CAPSTONE-EEE-2026",
            status=BookingStatus.CLOSED,
            idempotency_key="idemp_aarav_psu_006",
            policy_version_ids=["polv_nit_elec_v1"],
            decision_reason="Approved.",
            decided_by="usr_meera",
            decided_at=now - timedelta(days=3),
            eligibility_checks=[
                {"checkKey": "TRAINING_ELEC_INDUCTION", "label": "Electronics Lab Induction", "status": "PASS", "reason": "Verified", "blocking": True}
            ],
            handover_confirmed_by="usr_ravi",
            handover_confirmed_at=now - timedelta(days=2, hours=4),
            return_confirmed_by="usr_ravi",
            return_confirmed_at=now - timedelta(days=2, hours=1),
        ),
        # 7. Organisation B booking (Harbour Community) for tenant isolation test
        Booking(
            id="bkg_rohan_laser_approved",
            organization_id="org_harbour",
            resource_id="res_harbour_laser",
            user_id="usr_rohan",
            start_at=now + timedelta(hours=3),
            end_at=now + timedelta(hours=5),
            purpose="Cutting 5mm birch plywood chassis for community robotics workshop",
            status=BookingStatus.APPROVED,
            idempotency_key="idemp_rohan_laser_007",
            policy_version_ids=[],
            eligibility_checks=[
                {"checkKey": "TRAINING_LASER_CERT", "label": "Laser Safety Level 2", "status": "PASS", "reason": "Certified", "blocking": True}
            ],
            decision_reason="Approved by shop manager.",
            decided_by="usr_rohan",
            decided_at=now - timedelta(hours=1),
        ),
    ]
    session.add_all(bookings)
    await session.flush()

    print("Seeding condition reports...")
    cr_checkin = ConditionReport(
        id="cr_aarav_dmm_checkin",
        organization_id="org_nit",
        booking_id="bkg_aarav_dmm_active",
        stage="CHECK_IN",
        condition=ConditionLevel.EXCELLENT,
        accessories=[
            {"name": "TL75 Test Leads", "present": True, "condition": "EXCELLENT"},
            {"name": "AC175 Alligator Clips", "present": True, "condition": "EXCELLENT"},
            {"name": "80BK Temperature Probe", "present": True, "condition": "EXCELLENT"},
        ],
        notes="Checked out in pristine condition with all accessories verified in front of Lab Tech.",
        attachment_ids=[],
        attachment_hashes=[],
        acknowledged_rules=True,
        reporter_id="usr_aarav",
        reporter_name="Aarav Menon",
        actual_timestamp=now - timedelta(hours=1),
        staff_confirmed_by="usr_ravi",
        staff_confirmed_at=now - timedelta(hours=1),
    )
    cr_solder_return = ConditionReport(
        id="cr_kabir_solder_return",
        organization_id="org_nit",
        booking_id="bkg_kabir_solder_return_pending",
        stage="RETURN",
        condition=ConditionLevel.GOOD,
        accessories=[
            {"name": "Chisel Tip 2.4mm", "present": True, "condition": "GOOD"},
            {"name": "Conical Tip 0.8mm", "present": True, "condition": "GOOD"},
            {"name": "Brass Sponge", "present": True, "condition": "GOOD"},
            {"name": "ESD Ground Cord", "present": True, "condition": "GOOD"},
        ],
        notes="Cleaned tip with brass sponge and tinned with lead-free solder before turning off unit.",
        attachment_ids=[],
        attachment_hashes=[],
        acknowledged_rules=True,
        reporter_id="usr_kabir",
        reporter_name="Kabir Shah",
        actual_timestamp=now - timedelta(minutes=15),
    )
    session.add_all([cr_checkin, cr_solder_return])

    print("Seeding incidents with comments...")
    incident = Incident(
        id="inc_nit_camera_lens_scratch",
        organization_id="org_nit",
        booking_id="bkg_aarav_psu_closed",
        resource_id="res_psu",
        reporter_id="usr_aarav",
        reporter_name="Aarav Menon",
        category="MINOR_MALFUNCTION",
        reported_stage="RETURN",
        affected_part="Channel 2 Binding Post",
        description="Binding post terminal screw threads feel stiff when attaching heavy gauge wire. Operates fine electrically.",
        attachment_ids=[],
        attachment_hashes=[],
        status=IncidentStatus.RESOLVED,
        reviewer_id="usr_ravi",
        reviewer_name="Ravi Kulkarni",
        resolution_outcome="EQUIPMENT_MAINTAINED",
        resolution="Inspected binding post. Cleaned copper oxidation and applied silicone contact lubricant. Bench verified under full 3A load. No student fault.",
        resolved_at=now - timedelta(days=1),
        requires_human_review=True,
        assisted_draft_used=False,
    )
    comment = IncidentComment(
        id="cmt_inc_001",
        incident_id="inc_nit_camera_lens_scratch",
        author_id="usr_ravi",
        author_name="Ravi Kulkarni",
        author_role="MANAGER",
        message="Thanks for flagging early Aarav. Cleaned threads during morning maintenance cycle. Ready for regular service.",
    )
    session.add_all([incident, comment])

    print("Seeding notifications...")
    notifications = [
        Notification(
            id="notif_001",
            organization_id="org_nit",
            user_id="usr_aarav",
            type=NotificationType.DECISION,
            title="Booking Approved: Keysight 100MHz Oscilloscope",
            message="Your request for today has been approved by Dr. Meera Iyer. Collect key at Lab 301.",
            related_entity_id="bkg_aarav_scope_approved",
            related_path="/bookings/bkg_aarav_scope_approved",
            outbox_status=OutboxStatus.DELIVERED,
            read_at=now - timedelta(hours=3),
        ),
        Notification(
            id="notif_002",
            organization_id="org_nit",
            user_id="usr_diya",
            type=NotificationType.WAITLIST_CHANGE,
            title="Waitlist Position #1: Sony A7 IV Camera Kit",
            message="You are #1 on the waitlist for tomorrow. If the current slot is released, you will be offered promotion.",
            related_entity_id="bkg_diya_camera_waitlist",
            related_path="/bookings/bkg_diya_camera_waitlist",
            outbox_status=OutboxStatus.DELIVERED,
        ),
    ]
    session.add_all(notifications)

    print("Seeding outbox events...")
    outbox = [
        OutboxEvent(
            id="out_001",
            organization_id="org_nit",
            event_type="BOOKING_APPROVED",
            payload={"bookingId": "bkg_aarav_scope_approved", "userId": "usr_aarav", "resourceName": "Keysight InfiniiVision 100MHz Digital Oscilloscope"},
            status=OutboxStatus.DELIVERED,
            attempts=1,
            processed_at=now - timedelta(hours=4),
        )
    ]
    session.add_all(outbox)
    await session.flush()

    print("Seeding tamper-evident Trust Ledger events for org_nit...")
    # Seed canonical hash chain for org_nit
    await append_ledger_event(
        session,
        organization_id="org_nit",
        actor_id="usr_priya",
        actor_name="Priya Nair",
        actor_role="ADMIN",
        action="POLICY_ACTIVATED",
        entity_type=LedgerEntityType.POLICY,
        entity_id="pol_nit_elec_general",
        reason="Initial safety governance policy activation for Nilgiri Institute of Technology",
        metadata={"policyKind": "ELIGIBILITY", "version": 1},
        occurred_at=now - timedelta(days=60),
    )
    await append_ledger_event(
        session,
        organization_id="org_nit",
        actor_id="usr_meera",
        actor_name="Dr. Meera Iyer",
        actor_role="OWNER",
        action="RESOURCE_PUBLISHED",
        entity_type=LedgerEntityType.RESOURCE,
        entity_id="res_scope",
        reason="Commissioned Keysight Oscilloscope for student electronics lab access",
        metadata={"resourceName": "Keysight InfiniiVision 100MHz Digital Oscilloscope", "category": "ELECTRONICS"},
        occurred_at=now - timedelta(days=30),
    )
    await append_ledger_event(
        session,
        organization_id="org_nit",
        actor_id="usr_meera",
        actor_name="Dr. Meera Iyer",
        actor_role="OWNER",
        action="BOOKING_APPROVED",
        entity_type=LedgerEntityType.BOOKING,
        entity_id="bkg_aarav_scope_approved",
        reason="Approved for capstone testing during scheduled lab supervisor hours.",
        metadata={"userId": "usr_aarav", "resourceId": "res_scope", "startAt": (now + timedelta(hours=2)).isoformat()},
        occurred_at=now - timedelta(hours=4),
    )
    await append_ledger_event(
        session,
        organization_id="org_nit",
        actor_id="usr_ravi",
        actor_name="Ravi Kulkarni",
        actor_role="MANAGER",
        action="INCIDENT_RESOLVED",
        entity_type=LedgerEntityType.INCIDENT,
        entity_id="inc_nit_camera_lens_scratch",
        reason="Equipment serviced, cleaned, and verified. No student liability.",
        metadata={"outcome": "EQUIPMENT_MAINTAINED", "resourceId": "res_psu"},
        occurred_at=now - timedelta(days=1),
    )

    print("Seeding tamper-evident Trust Ledger events for org_harbour...")
    await append_ledger_event(
        session,
        organization_id="org_harbour",
        actor_id="usr_rohan",
        actor_name="Rohan Deshmukh",
        actor_role="ADMIN",
        action="RESOURCE_PUBLISHED",
        entity_type=LedgerEntityType.RESOURCE,
        entity_id="res_harbour_laser",
        reason="Harbour Makerspace laser cutter published for certified members",
        metadata={"resourceName": "Epilog Fusion Pro 48 CO2 Laser Cutter", "category": "ELECTRONICS"},
        occurred_at=now - timedelta(days=10),
    )

    await session.commit()
    print("Seed complete! Verifying ledger chains...")
    res_nit = await verify_ledger_chain(session, "org_nit")
    res_harbour = await verify_ledger_chain(session, "org_harbour")
    print(f"org_nit ledger verification: valid={res_nit['valid']}, count={res_nit['checked_count']}, head_hash={res_nit['head_hash'][:16]}...")
    print(f"org_harbour ledger verification: valid={res_harbour['valid']}, count={res_harbour['checked_count']}, head_hash={res_harbour['head_hash'][:16]}...")
    assert res_nit["valid"] is True
    assert res_harbour["valid"] is True
    print("All ledger chains verified successfully!")


async def main() -> None:
    async with migration_session_factory() as session:
        await seed_database(session)


if __name__ == "__main__":
    asyncio.run(main())
