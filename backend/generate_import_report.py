#!/usr/bin/env python
import os
import sys
import argparse
import django

# Setup Django environment
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'expenselens.settings')
django.setup()

from expenses.models import ImportBatch, ImportReport

def main():
    parser = argparse.ArgumentParser(description="ExpenseLens Import Report Generator")
    parser.add_argument('--batch-id', type=str, help="UUID of the Import Batch to render")
    parser.add_argument('--output', type=str, help="Filepath to write the Markdown report to")
    parser.add_argument('--list', action='store_true', help="List all available Import Batches")
    
    args = parser.parse_args()

    if args.list:
        batches = ImportBatch.objects.all()
        if not batches.exists():
            print("No import batches found in database.")
            return
        print(f"{'Batch ID':<38} | {'File Name':<25} | {'Health Score':<12} | {'Timestamp'}")
        print("-" * 90)
        for b in batches:
            print(f"{str(b.id):<38} | {b.uploaded_file_name:<25} | {b.health_score:<12} | {b.import_timestamp}")
        return

    if not args.batch_id:
        print("Error: Please specify a --batch-id or use --list to see available batches.", file=sys.stderr)
        sys.exit(1)

    try:
        batch = ImportBatch.objects.get(id=args.batch_id)
    except (ImportBatch.DoesNotExist, ValueError):
        print(f"Error: Import Batch with ID '{args.batch_id}' not found.", file=sys.stderr)
        sys.exit(1)

    report = ImportReport.objects.filter(batch=batch).first()
    if not report:
        print(f"Error: No report has been generated yet for Batch '{args.batch_id}'.", file=sys.stderr)
        sys.exit(1)

    markdown_report = report.report_markdown

    if args.output:
        try:
            with open(args.output, 'w', encoding='utf-8') as f:
                f.write(markdown_report)
            print(f"Report written successfully to {args.output}")
        except Exception as e:
            print(f"Error writing to file: {e}", file=sys.stderr)
            sys.exit(1)
    else:
        print("\n" + "="*80)
        print(" GENERATED IMPORT REPORT")
        print("="*80 + "\n")
        print(markdown_report)
        print("\n" + "="*80 + "\n")

if __name__ == "__main__":
    main()
