from environments.models import Environment

RECOMMENDED_TASKS = {
    Environment.Type.HOUSE: [
        {"name": "Lavar louça", "icon": "dishes"},
        {"name": "Tirar o lixo", "icon": "trash"},
        {"name": "Limpar o banheiro", "icon": "bathroom"},
        {"name": "Varrer a casa", "icon": "broom"},
        {"name": "Arrumar o quarto", "icon": "bed"},
        {"name": "Lavar roupa", "icon": "laundry"},
        {"name": "Passar pano no chão", "icon": "mop"},
        {"name": "Cozinhar", "icon": "cooking"},
    ],
    Environment.Type.OFFICE: [
        {"name": "Organizar a mesa", "icon": "desk"},
        {"name": "Limpar a copa", "icon": "kitchen"},
        {"name": "Repor material", "icon": "supplies"},
        {"name": "Tirar o lixo", "icon": "trash"},
        {"name": "Regar as plantas", "icon": "plant"},
    ],
    Environment.Type.WORK: [
        {"name": "Limpar a bancada", "icon": "counter"},
        {"name": "Organizar ferramentas", "icon": "tools"},
        {"name": "Tirar o lixo", "icon": "trash"},
        {"name": "Repor estoque", "icon": "stock"},
    ],
    Environment.Type.OTHER: [
        {"name": "Tarefa geral", "icon": "task"},
    ],
}


def get_recommended_tasks(env_type):
    return RECOMMENDED_TASKS.get(env_type, [])
