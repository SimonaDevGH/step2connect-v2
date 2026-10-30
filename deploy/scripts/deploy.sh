#!/usr/bin/env bash
# Deploy di un ambiente Step2Connect sul server OVH (B4).
#   deploy/scripts/deploy.sh <dev|prod> [ref]
# ref: branch, tag o SHA (default: develop per dev, main per prod).
# Eseguire come utente "deploy" (membro del gruppo docker).
#
# Flusso: fetch → checkout ref → build immagine taggata con lo SHA → up →
# health check su /api/health → rollback automatico all'immagine precedente
# se il nuovo container non risponde.
set -euo pipefail

# Tutto dentro main(): bash legge l'intera funzione prima di eseguirla, quindi
# il checkout di una nuova versione di questo stesso file non lo altera a metà.
main() {
  local app_env="${1:?ambiente richiesto: dev|prod}"
  [[ "$app_env" =~ ^(dev|prod)$ ]] || { echo "Ambiente non valido: $app_env" >&2; exit 1; }

  local default_ref=develop
  [[ "$app_env" == prod ]] && default_ref=main
  local ref="${2:-$default_ref}"

  local base_dir="${BASE_DIR:-/opt/step2connect}"
  local env_dir="$base_dir/$app_env"
  local app_dir="$env_dir/app"
  local env_file="$env_dir/.env"
  local tag_file="$env_dir/.current_tag"
  local project="step2connect-$app_env"

  [[ -d "$app_dir/.git" ]] || { echo "Repository non trovato in $app_dir" >&2; exit 1; }
  [[ -f "$env_file" ]] || { echo "File ambiente non trovato: $env_file" >&2; exit 1; }

  exec 9>"$env_dir/.deploy.lock"
  flock -n 9 || { echo "Deploy $app_env già in corso" >&2; exit 1; }

  local host_port
  host_port="$(grep -E '^HOST_PORT=' "$env_file" | tail -n1 | cut -d= -f2- | tr -d '[:space:]"')"
  [[ "$host_port" =~ ^[0-9]+$ ]] || { echo "HOST_PORT non valido in $env_file" >&2; exit 1; }

  echo "==> [$app_env] fetch e checkout di '$ref'"
  cd "$app_dir"
  git fetch --prune --tags origin
  if git rev-parse --verify --quiet "origin/$ref^{commit}" >/dev/null; then
    git checkout --quiet --detach "origin/$ref"
  else
    git checkout --quiet --detach "$ref"
  fi
  local sha
  sha="$(git rev-parse --short=12 HEAD)"
  echo "    commit: $(git log -1 --format='%h %s (%an, %ad)' --date=short)"

  local prev_tag=""
  [[ -f "$tag_file" ]] && prev_tag="$(cat "$tag_file")"

  export APP_ENV="$app_env" ENV_FILE="$env_file" HOST_PORT="$host_port"
  local compose=(docker compose -p "$project" --env-file "$env_file" -f "$app_dir/deploy/docker-compose.yml")

  echo "==> [$app_env] build immagine step2connect:$app_env-$sha"
  IMAGE_TAG="$sha" "${compose[@]}" build --pull

  echo "==> [$app_env] avvio container"
  IMAGE_TAG="$sha" "${compose[@]}" up -d --no-build --remove-orphans

  if wait_healthy "$host_port"; then
    echo "$sha" > "$tag_file"
    echo "==> [$app_env] deploy OK: $sha su 127.0.0.1:$host_port"
    prune_images "$app_env" "$sha" "$prev_tag"
  else
    echo "!!! [$app_env] health check fallito per $sha" >&2
    IMAGE_TAG="$sha" "${compose[@]}" logs --tail=80 app >&2 || true
    if [[ -n "$prev_tag" ]]; then
      echo "==> [$app_env] rollback a $prev_tag" >&2
      IMAGE_TAG="$prev_tag" "${compose[@]}" up -d --no-build --remove-orphans
      wait_healthy "$host_port" && echo "==> rollback completato" >&2
    fi
    exit 1
  fi
}

wait_healthy() {
  local port="$1"
  for _ in $(seq 1 30); do
    if curl -fsS "http://127.0.0.1:$port/api/health" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  return 1
}

# Mantiene l'immagine corrente, la precedente (per rollback) e le 2 più recenti.
prune_images() {
  local app_env="$1" keep_a="$2" keep_b="$3"
  docker image ls --filter "reference=step2connect:$app_env-*" \
      --format '{{.CreatedAt}}|{{.Tag}}' \
    | sort -r | tail -n +4 | cut -d'|' -f2 \
    | while read -r tag; do
        [[ "$tag" == "$app_env-$keep_a" || "$tag" == "$app_env-$keep_b" ]] && continue
        docker image rm "step2connect:$tag" >/dev/null 2>&1 || true
      done
  docker image prune -f >/dev/null 2>&1 || true
}

main "$@"
exit
