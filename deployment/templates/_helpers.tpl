{{- define "nodeAffinity" }}
nodeAffinity:
  requiredDuringSchedulingIgnoredDuringExecution:
    nodeSelectorTerms:
      - matchExpressions:
          - key: {{ .Values.App.affinityKey }}
            operator: In
            values:
              - "{{ .Values.App.affinityValue }}"
{{- end }}
{{- define "podAntiAffinity" }}
podAntiAffinity:
  requiredDuringSchedulingIgnoredDuringExecution:
  - labelSelector:
      matchLabels:
        app: {{ .Values.App.name }}
    topologyKey: kubernetes.io/hostname
{{- end }}