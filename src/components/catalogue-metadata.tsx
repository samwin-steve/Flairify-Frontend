"use client";
import { Skeleton } from "./ui/loading";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { CatalogueEnrichment } from "@/lib/types";
import { Modal } from "./ui/dialog";

const label = (value: string) => value.replaceAll("_", " ");
const sources = {
  seller: "Seller supplied",
  visual: "Photo observation",
  styling_inference: "Styling suggestion",
};

export function CatalogueMetadata({
  productId,
  name,
  onClose,
}: {
  productId: string;
  name: string;
  onClose: () => void;
}) {
  const data = useQuery({
    queryKey: ["catalogue-metadata", productId],
    queryFn: () =>
      api<{ current: boolean; enrichment: CatalogueEnrichment | null }>(
        `/admin/products/${productId}/metadata`,
      ),
    refetchInterval: 5000,
  });
  const record = data.data?.enrichment;
  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Styling details"
      description={name}
    >
      {data.isLoading && <Skeleton label="Loading product details" />}
      {data.error && (
        <p className="error" role="alert">
          {data.error.message}
        </p>
      )}
      {data.data && !record && (
        <p>Details will appear after this listing has been analyzed.</p>
      )}
      {record && (
        <div className="form-stack catalogue-metadata">
          <p className="small-note">
            {record.status === "failed"
              ? "Product analysis could not finish"
              : record.status === "unavailable"
                ? "Product analysis is unavailable"
                : record.input_mode === "image_and_text"
                  ? "Product photo and listing analyzed"
                  : "Listing text analyzed; no product photograph was available"}
            .
            {data.data?.current
              ? ""
              : " This analysis is not current. Refresh search details to process the latest listing."}
          </p>
          <p className="small-note">
            Confidence is the model’s estimate, not a verified probability.
            Styling suggestions do not establish material properties or exact
            fit.
          </p>
          {record.error && <p className="error">{record.error}</p>}
          {record.tags.map((tag) => (
            <div className="metadata-tag" key={`${tag.field}-${tag.value}`}>
              <div className="section-line">
                <strong>{label(tag.value)}</strong>
                <span className="pill">
                  {Math.round(tag.confidence * 100)}%
                </span>
              </div>
              <p className="small-note">
                {label(tag.field)} · {sources[tag.source]}
                {tag.confidence < 0.65 ? " · Not used in search" : ""}
              </p>
              <p>{tag.evidence}</p>
            </div>
          ))}
          {!!record.unknown_fields.length && (
            <div>
              <h3>Not established</h3>
              <p className="small-note">
                {record.unknown_fields.map(label).join(", ")}
              </p>
            </div>
          )}
          {!!record.uncertainties.length && (
            <div>
              <h3>Review notes</h3>
              <ul>
                {record.uncertainties.map((note, i) => (
                  <li key={i}>{note}</li>
                ))}
              </ul>
            </div>
          )}
          {!!record.validation_issues.length && (
            <details>
              <summary>
                Validation checks ({record.validation_issues.length})
              </summary>
              <ul>
                {record.validation_issues.map((issue) => (
                  <li key={issue}>{label(issue.replace(":", ": "))}</li>
                ))}
              </ul>
            </details>
          )}
          <p className="small-note">
            Schema {record.schema_version} ·{" "}
            {new Date(record.assessed_at).toLocaleString()}
          </p>
        </div>
      )}
    </Modal>
  );
}
