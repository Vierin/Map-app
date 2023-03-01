#!/bin/sh
remote="$1"
url="$2"
result=0

status=$(! grep -Rq "development" "status.txt" && echo 'prod' || echo 'dev')
html=$(! grep -q "<!-- development -->" "dist/index.html" && echo 'prod' || echo 'dev')
js=$(! grep -q "* development *" "dist/js/script.js" && echo 'prod' || echo 'dev')
css=$(! grep -q 'status: "development"' "dist/css/main.css" && echo 'prod' || echo 'dev')



# check status when pushing to washpost repository:
if [[ "$url" =~ "wapobrandstudio" ]]; then

    if [[ $js = 'dev' ]] || [[ $html = 'dev' ]] || [[ $css = 'dev' ]]; then
        echo "\033[0;31m✕ ============== PUSH REJECTED =============="
    fi

    if [[ $js = 'dev' && $html = 'dev' && $css = 'dev' ]]
        then
            echo "\033[0;31m✕          Development version found"
            echo "\033[0;31m✕     Run \033[0;33mgulp --release\033[0m\033[0;31m before next push"
            result=1
    else

        if [[ $js = 'dev' ]]; then
            echo "\033[0;31m✕         Scripts in development mode"
            echo "\033[0;31m✕ Run \033[0;33mgulp scripts --release\033[0m\033[0;31m before next push"
            result=1
        fi

        if [[ $html = 'dev' ]]; then
            echo "\033[0;31m✕           Html in development mode"
            echo "\033[0;31m✕   Run \033[0;33mgulp html --release\033[0m\033[0;31m before next push"
            result=1
        fi

        if [[ $css = 'dev' ]]; then
            echo "\033[0;31m✕          Styles in development mode"
            echo "\033[0;31m✕  Run \033[0;33mgulp styles --release\033[0m\033[0;31m before next push"
            result=1
        fi
    fi

    if [[ $result = 1 ]]; then
        echo "\033[0;31m✕ ===========================================\033[0m"
    else
        echo "\033[0;32m✓ ========================"
        echo "\033[0;32m✓ Production version found"
        echo "\033[0;32m✓ ========================\033[0m"
    fi
fi



# bump version while pushing to default repository:
if [[ "$url" =~ "wapobrandstudio/default-setup-gulp" ]]; then
    if [[ $js = 'prod' && $html = 'prod' && $css = 'prod' ]]
        then
            npm run bump
            git add package.json
            git add dist/index.html
            git add dist/all.html
            git add views/partials/foot.twig
            git add views/partials/head.twig
            git add views/partials/meta-tags.twig
            git commit -m "bump"
        else result=1
    fi
fi
exit $result
