import { useFeatures, useUpdateFeature } from "../../hooks/resources";
import { useToast } from "../../hooks/useToast";
import { ApiError } from "../../lib/api-client";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/Feedback";
import { TBody, TD, TH, THead, TR, Table } from "../../components/ui/Table";

export function FeaturesPage() {
  const toast = useToast();
  const featuresQuery = useFeatures();
  const updateMutation = useUpdateFeature();

  const toggle = async (id: string, name: string, enabled: boolean) => {
    try {
      await updateMutation.mutateAsync({ id, is_enabled: enabled });
      toast.success(`${name} ${enabled ? "enabled" : "disabled"}`);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : "Could not update the feature.");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Features</h1>
        <p className="mt-1 text-sm text-muted">
          The feature catalog is defined in code. Disabling a feature globally blocks it for everyone.
        </p>
      </div>

      <Card>
        <CardHeader title="Feature catalog" />
        <CardBody>
          {featuresQuery.isLoading ? <LoadingState /> : null}
          {featuresQuery.isError ? <ErrorState message="Could not load features." onRetry={() => void featuresQuery.refetch()} /> : null}
          {featuresQuery.data && featuresQuery.data.length === 0 ? <EmptyState title="No features" /> : null}
          {featuresQuery.data && featuresQuery.data.length > 0 ? (
            <Table>
              <THead>
                <TR>
                  <TH>Code</TH>
                  <TH>Name</TH>
                  <TH>Description</TH>
                  <TH>Status</TH>
                  <TH />
                </TR>
              </THead>
              <TBody>
                {featuresQuery.data.map((feature) => (
                  <TR key={feature.id}>
                    <TD className="font-mono text-xs">{feature.code}</TD>
                    <TD className="font-medium">{feature.name}</TD>
                    <TD className="text-muted">{feature.description ?? "—"}</TD>
                    <TD>
                      <Badge tone={feature.is_enabled ? "success" : "neutral"}>
                        {feature.is_enabled ? "enabled" : "disabled"}
                      </Badge>
                    </TD>
                    <TD>
                      <div className="flex justify-end">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => void toggle(feature.id, feature.name, !feature.is_enabled)}
                        >
                          {feature.is_enabled ? "Disable" : "Enable"}
                        </Button>
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          ) : null}
        </CardBody>
      </Card>
    </div>
  );
}
