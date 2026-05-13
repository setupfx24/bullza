.PHONY: deploy deploy-no-pull logs ps
SHELL := /bin/bash

deploy:
	@./scripts/deploy.sh

deploy-no-pull:
	@./scripts/deploy.sh --no-pull

ps:
	@docker compose -f docker-compose.yml -f docker-compose.prod.yml ps

logs:
	@docker compose -f docker-compose.yml -f docker-compose.prod.yml logs --tail=100 -f
