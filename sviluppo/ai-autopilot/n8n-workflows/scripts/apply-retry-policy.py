#!/usr/bin/env python3
"""
apply-retry-policy.py — Global Retry Policy Applier for N8N Workflows

Applica la retry policy (maxTries: 3, waitBetweenTries: 2000ms) a tutti gli nodi
n8n-nodes-base.httpRequest nei workflow critici.

Target workflows (esclude W27, W29):
  - W20, W21, W22, W23, W40, W41, W45, W46, W49, W50

Comportamento:
  1. Itera ogni workflow nei file JSON
  2. Trova tutti i nodi di tipo 'n8n-nodes-base.httpRequest'
  3. Se non ha options.retry → aggiunge retry config
  4. Se ha retry → verifica e eventualmente aggiorna
  5. Salva file con backup .bak.20260520-pre-retry
  6. Output: lista workflow modificati

Usage:
  python apply-retry-policy.py [--dry-run] [--target W20,W21,...]

Author: N8N Workflow Evolution
Date: 2026-05-20
"""

import json
import os
import sys
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Tuple

# Target workflows (esclude W27 idempotency, W29 HMAC)
DEFAULT_TARGETS = ["w20", "w21", "w22", "w23", "w40", "w41", "w45", "w46", "w49", "w50"]

RETRY_CONFIG = {
    "enabled": True,
    "maxTries": 3,
    "waitBetweenTries": 2000
}

SKIP_WORKFLOWS = ["w27", "w29"]  # Idempotency + HMAC validators — no retry


def find_workflow_files(base_path: str, targets: List[str]) -> Dict[str, Path]:
    """Trova i file JSON dei workflow target."""
    workflows = {}
    base = Path(base_path)

    if not base.exists():
        print(f"[ERROR] Base path not found: {base_path}")
        sys.exit(1)

    # Cerca in workflows/ directory
    workflows_dir = base / "workflows"
    if workflows_dir.exists():
        for json_file in workflows_dir.glob("*.json"):
            filename = json_file.stem.lower()
            # Match pattern: {number}-{name} or {name}
            for target in targets:
                if target in filename or filename.startswith(target.replace("w", "")):
                    workflows[target] = json_file
                    break

    return workflows


def apply_retry_to_workflow(file_path: Path, dry_run: bool = False) -> Tuple[int, List[str]]:
    """
    Applica retry policy a un singolo workflow.

    Returns: (nodes_modified, node_names_modified)
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            workflow = json.load(f)
    except (json.JSONDecodeError, IOError) as e:
        print(f"[ERROR] Cannot read {file_path}: {e}")
        return 0, []

    nodes = workflow.get('nodes', [])
    modified_count = 0
    modified_nodes = []

    for node in nodes:
        if node.get('type') == 'n8n-nodes-base.httpRequest':
            node_id = node.get('id', 'unknown')
            node_name = node.get('name', 'unnamed')

            # Accedi a parameters.options
            if 'parameters' not in node:
                node['parameters'] = {}

            if 'options' not in node['parameters']:
                node['parameters']['options'] = {}

            # Controlla se retry esiste
            if 'retry' not in node['parameters']['options']:
                node['parameters']['options']['retry'] = RETRY_CONFIG.copy()
                modified_count += 1
                modified_nodes.append(f"{node_id} ({node_name})")
                print(f"  [+] {node_id}: retry policy ADDED")
            else:
                # Verifica se la config è corretta
                current_retry = node['parameters']['options']['retry']
                if (current_retry.get('enabled') != RETRY_CONFIG['enabled'] or
                    current_retry.get('maxTries') != RETRY_CONFIG['maxTries'] or
                    current_retry.get('waitBetweenTries') != RETRY_CONFIG['waitBetweenTries']):
                    # Update
                    node['parameters']['options']['retry'] = RETRY_CONFIG.copy()
                    modified_count += 1
                    modified_nodes.append(f"{node_id} ({node_name})")
                    print(f"  [~] {node_id}: retry policy UPDATED")
                else:
                    print(f"  [✓] {node_id}: retry already correct")

    # Salva se modificato e non dry-run
    if modified_count > 0 and not dry_run:
        # Crea backup
        backup_path = file_path.with_suffix(f".bak.20260520-pre-retry")
        try:
            with open(file_path, 'r', encoding='utf-8') as src:
                with open(backup_path, 'w', encoding='utf-8') as dst:
                    dst.write(src.read())
            print(f"  [Backup] → {backup_path.name}")
        except IOError as e:
            print(f"  [WARNING] Backup failed: {e}")

        # Salva workflow modificato
        try:
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(workflow, f, indent=2, ensure_ascii=False)
            print(f"  [Saved] {file_path.name}")
        except IOError as e:
            print(f"  [ERROR] Cannot save {file_path}: {e}")
            return 0, []

    return modified_count, modified_nodes


def main():
    """Entry point."""
    import argparse

    parser = argparse.ArgumentParser(
        description="Apply global retry policy to N8N workflow HTTP nodes"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview changes without modifying files"
    )
    parser.add_argument(
        "--target",
        default=",".join(DEFAULT_TARGETS),
        help=f"Comma-separated workflow targets (default: {','.join(DEFAULT_TARGETS)})"
    )
    parser.add_argument(
        "--base-path",
        default="/home/mrxxx/Dropbox/1 Programmazione/Progetti/ChromePlugin/sviluppo/ai-autopilot/n8n-workflows",
        help="Base path to n8n-workflows directory"
    )

    args = parser.parse_args()

    targets = [t.strip().lower() for t in args.target.split(",")]
    targets = [t if t.startswith("w") else f"w{t}" for t in targets]
    # Filtra skip list
    targets = [t for t in targets if t not in SKIP_WORKFLOWS]

    print(f"\n{'='*70}")
    print(f"N8N Global Retry Policy Applier")
    print(f"{'='*70}")
    print(f"Mode: {'DRY RUN (preview only)' if args.dry_run else 'APPLY (modifying files)'}")
    print(f"Base path: {args.base_path}")
    print(f"Target workflows: {', '.join(targets)}")
    print(f"{'='*70}\n")

    # Trova workflow files
    workflows = find_workflow_files(args.base_path, targets)

    if not workflows:
        print("[WARNING] No workflow files found matching targets")
        return 1

    print(f"Found {len(workflows)} workflow file(s):\n")

    total_modified = 0
    all_modified_nodes = []

    # Applica retry policy a ogni workflow
    for target, file_path in sorted(workflows.items()):
        print(f"{target.upper()} ({file_path.name}):")
        modified, nodes = apply_retry_to_workflow(file_path, dry_run=args.dry_run)
        total_modified += modified
        all_modified_nodes.extend(nodes)
        print()

    # Report finale
    print(f"{'='*70}")
    print(f"SUMMARY:")
    print(f"  Workflows processed: {len(workflows)}")
    print(f"  HTTP nodes modified: {total_modified}")
    print(f"  Mode: {'DRY RUN' if args.dry_run else 'APPLIED'}")
    if total_modified > 0:
        print(f"  Backup suffix: .bak.20260520-pre-retry")
    print(f"{'='*70}\n")

    if total_modified > 0:
        print(f"Modified nodes ({len(all_modified_nodes)}):")
        for node in all_modified_nodes:
            print(f"  • {node}")
        print()

    if args.dry_run and total_modified > 0:
        print("[DRY RUN] Re-run without --dry-run to apply changes.\n")

    return 0


if __name__ == "__main__":
    sys.exit(main())
