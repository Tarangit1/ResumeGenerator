
import os
from jinja2 import Environment, FileSystemLoader

try:
    _tex_env = Environment(
        loader=FileSystemLoader("."),
        block_start_string="{%","%}",
        variable_start_string="{{","}}",
        comment_start_string="{#",
        comment_end_string="#}",
    )
    print("Environment created successfully")
    
    template_str = r"\textbf{ {{- category | replace('_', ' ') | title -}} :} & {{ skill_list | join(', ') }}"
    template = _tex_env.from_string(template_str)
    rendered = template.render(category="some_category", skill_list=["A", "B"])
    print(f"Rendered: {rendered}")

except Exception as e:
    print(f"Error: {e}")
