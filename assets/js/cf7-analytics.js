jQuery(document).ready(function($) {
    let radarChart = null;
    let barChart = null;

    $('.form-link').on('click', function(e) {
        e.preventDefault();
        const formId = $(this).data('form-id');
        console.log('Clicou no form ID:', formId);
        loadFormData(formId);
    });

    function loadFormData(formId) {
        // Reset e mostra loading
        resetDisplay();
        showLoading();

        $.ajax({
            url: cf7AnalyticsAjax.ajaxurl,
            type: 'POST',
            data: {
                action: 'get_form_data',
                nonce: cf7AnalyticsAjax.nonce,
                form_id: formId
            },
            success: function(response) {
                console.log('Resposta completa:', response); // Log da resposta completa
                hideLoading();
                
                if (response.success && response.data) {
                    const data = response.data;
                    console.log('Dados do post:', data.post_data); // Log dos dados do post
                    
                    
                    const hasProfessorAndData = data.submissions.length > 0 && 
                            data.submissions[0].professor != '' && 
                            data.submissions[0].data != '';

                    // Primeiro, mostra o container principal
                    $('#form-details').html(`
                        <div id="gutenberg-content" class="gutenberg-content card-chart-analitycs">
                            <div class="content-header"></div>
                            <div class="content-blocks"></div>
                        </div>
                        <div class="charts-wrapper card-chart-analitycs">
                            <div class="chart-container">
                                <h3>Média das Avaliações</h3>
                                <div class="chart-area">
                                    <canvas id="radar-chart"></canvas>
                                </div>
                            </div>
                            <div class="chart-container">
                                <h3>Distribuição das Avaliações</h3>
                                <div class="chart-area">
                                    <canvas id="bar-chart"></canvas>
                                </div>
                            </div>
                        </div>
                        <div class="submissions-table-container card-chart-analitycs">
                            <h3>Submissões Detalhadas</h3>
                            <div class="table-responsive">
                                <table class="wp-list-table widefat fixed striped">
                                    <thead>
                                        <tr>
                                            <th>Nome do Aluno</th>
                                            <th>Email</th>
                                            ${hasProfessorAndData ? `
                                            <th>Professor</th>
                                            <th>Data</th>
                                            ` : ''}
                                            <th>Pontualidade</th>
                                            <th>Plano de Ensino</th>
                                            <th>Comunicação</th>
                                            <th>Didática</th>
                                            <th>Motivação</th>
                                            <th>Sugestões</th>
                                        </tr>
                                    </thead>
                                    <tbody id="submissions-data"></tbody>
                                </table>
                            </div>
                        </div>
                    `).show();

                    // Renderiza o conteúdo do Gutenberg se existir
                    if (data.post_data) {
                        console.log('Renderizando dados do post:', data.post_data);
                        renderGutenbergContent(data.post_data);
                    }
                    
                    // Atualiza gráficos e tabela se houver submissões
                    if (data.submissions && data.submissions.length > 0) {
                        updateCharts(data.submissions);
                        updateTable(data.submissions);
                    } else {
                        showNoDataMessage();
                    }
                } else {
                    console.error('Erro na resposta:', response);
                    showError(response.data ? response.data.message : 'Erro ao carregar dados');
                }
            },
            error: function(xhr, status, error) {
                console.error('Erro na requisição:', {xhr, status, error});
                hideLoading();
                showError('Erro na comunicação com o servidor');
            }
        });
    }

    function updateCharts(submissions) {
        const metrics = ['pontualidade', 'plano_ensino', 'comunicacao', 'didatica', 'motivacao'];
        const labels = ['Pontualidade', 'Plano de Ensino', 'Comunicação', 'Didática', 'Motivação'];
        
        // Calculate averages (excluindo "Não se aplica" da média)
        const averages = metrics.map(metric => {
            const values = submissions.map(s => {
                const val = s[metric];
                if (val === 'Não se aplica') return null;
                return val === 'Alto' ? 3 : (val === 'Médio' ? 2 : 1);
            }).filter(v => v !== null); // Remove os "Não se aplica" do cálculo

            return values.length > 0 ? 
                parseFloat((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2)) : 
                0;
        });

        // Update Radar Chart
        if (radarChart) {
            radarChart.destroy();
        }

        const radarCtx = document.getElementById('radar-chart');
        if (radarCtx) {
            radarChart = new Chart(radarCtx, {
                type: 'radar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Média das Avaliações',
                        data: averages,
                        fill: true,
                        backgroundColor: 'rgba(54, 162, 235, 0.2)',
                        borderColor: 'rgb(54, 162, 235)',
                        pointBackgroundColor: 'rgb(54, 162, 235)',
                        pointBorderColor: '#fff',
                        pointHoverBackgroundColor: '#fff',
                        pointHoverBorderColor: 'rgb(54, 162, 235)'
                    }]
                },
                options: {
                    responsive: true,
                    scales: {
                        r: {
                            beginAtZero: true,
                            min: 0,
                            max: 3,
                            ticks: {
                                stepSize: 1
                            }
                        }
                    },
                    plugins: {
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    return `Média: ${context.raw.toFixed(2)}`;
                                }
                            }
                        }
                    }
                }
            });
        }

        // Count ratings distribution
        const counts = metrics.map(metric => {
            const metricCounts = {
                'Alto': 0,
                'Médio': 0,
                'Baixo': 0,
                'Não se aplica': 0
            };
            submissions.forEach(s => {
                const val = s[metric];
                if (metricCounts[val] !== undefined) {
                    metricCounts[val]++;
                }
            });
            return metricCounts;
        });

        // Update Bar Chart
        if (barChart) {
            barChart.destroy();
        }

        const barCtx = document.getElementById('bar-chart');
        if (barCtx) {
            barChart = new Chart(barCtx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'Alto',
                            data: counts.map(c => c.Alto),
                            backgroundColor: 'rgba(75, 192, 192, 0.8)'
                        },
                        {
                            label: 'Médio',
                            data: counts.map(c => c.Médio),
                            backgroundColor: 'rgba(255, 206, 86, 0.8)'
                        },
                        {
                            label: 'Baixo',
                            data: counts.map(c => c.Baixo),
                            backgroundColor: 'rgba(255, 99, 132, 0.8)'
                        },
                        {
                            label: 'Não se aplica',
                            data: counts.map(c => c['Não se aplica']),
                            backgroundColor: 'rgba(156, 156, 156, 0.8)' // Cinza para "Não se aplica"
                        }
                    ]
                },
                options: {
                    responsive: true,
                    scales: {
                        x: {
                            stacked: true,
                        },
                        y: {
                            stacked: true,
                            beginAtZero: true
                        }
                    },
                    plugins: {
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const label = context.dataset.label || '';
                                    const value = context.raw || 0;
                                    const total = context.chart.data.datasets.reduce((acc, dataset) => {
                                        return acc + (dataset.data[context.dataIndex] || 0);
                                    }, 0);
                                    const percentage = ((value / total) * 100).toFixed(1);
                                    return `${label}: ${value} (${percentage}%)`;
                                }
                            }
                        }
                    }
                }
            });
        }
    }

    function updateTable(submissions) {
        const tbody = $('#submissions-data');
        tbody.empty();

        submissions.forEach(submission => {
            const row = $('<tr>');
            row.append(`<td>${escapeHtml(submission.nome)}</td>`);
            row.append(`<td>${escapeHtml(submission.email)}</td>`);
            if(submission.professor) row.append(`<td>${escapeHtml(submission.professor)}</td>`);
            if(submission.data) row.append(`<td>${escapeHtml(submission.data)}</td>`);
            row.append(`<td>${escapeHtml(submission.pontualidade)}</td>`);
            row.append(`<td>${escapeHtml(submission.plano_ensino)}</td>`);
            row.append(`<td>${escapeHtml(submission.comunicacao)}</td>`);
            row.append(`<td>${escapeHtml(submission.didatica)}</td>`);
            row.append(`<td>${escapeHtml(submission.motivacao)}</td>`);
            row.append(`<td>${escapeHtml(submission.sugestoes)}</td>`);
            tbody.append(row);
        });
    }

    function renderGutenbergContent(postData) {
        console.log('Iniciando renderização do conteúdo:', postData);
        
        const container = $('#gutenberg-content');
        const header = container.find('.content-header');
        const blocks = container.find('.content-blocks');
        
        console.log('Elementos encontrados:', {
            container: container.length,
            header: header.length,
            blocks: blocks.length
        });

        // Limpa o conteúdo anterior
        header.empty();
        blocks.empty();

        // Adiciona título
        if (postData.post_title) {
            console.log('Adicionando título:', postData.post_title);
            header.html(`
                <h2 class="content-title">${escapeHtml(postData.post_title)}</h2>
            `);
        }

        // Renderiza blocos
        if (postData.blocks && postData.blocks.length > 0) {
            console.log(`Renderizando ${postData.blocks.length} blocos`);
            
            postData.blocks.forEach((block, index) => {
                console.log(`Renderizando bloco ${index}:`, block);
                
                const blockElement = $('<div/>', {
                    class: `gutenberg-block block-${block.blockName.replace('/', '-')}`,
                    'data-block-type': block.blockName
                });

                if (block.content) {
                    blockElement.html(block.content);
                }

                blocks.append(blockElement);
            });
        } else {
            console.log('Nenhum bloco encontrado');
            blocks.html('<p class="no-content">Nenhum conteúdo adicional encontrado.</p>');
        }

        // Mostra o container
        container.show();
    }


    function resetDisplay() {
        if (radarChart) {
            radarChart.destroy();
            radarChart = null;
        }
        if (barChart) {
            barChart.destroy();
            barChart = null;
        }
        $('#form-details').empty().hide();
    }

    function showLoading() {
        $('#form-details')
            .html('<div class="form-loading"><span class="spinner is-active"></span> Carregando...</div>')
            .show();
    }

    function hideLoading() {
        $('.form-loading').remove();
    }

    function showError(message) {
        $('#form-details')
            .html(`<div class="notice notice-error"><p>${escapeHtml(message)}</p></div>`)
            .show();
    }

    function showNoDataMessage() {
        $('.charts-wrapper, .submissions-table-container')
            .html(`<div class="notice notice-warning"><p>Nenhum dado encontrado para este formulário.</p></div>`);
    }

    function escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe
            .toString()
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
});


jQuery(document).ready(function($) {
    // Funcionalidade de busca
    $('#form-search').on('input', function() {
        const searchTerm = $(this).val().toLowerCase();
        
        $('.forms-list .form-item').each(function() {
            const $item = $(this);
            const $link = $item.find('.form-link');
            const formTitle = $link.text().toLowerCase();
            const gutenbergData = $link.find('.form-meta').text().toLowerCase();
            
            // Busca no título e no conteúdo do Gutenberg
            const found = formTitle.includes(searchTerm) || gutenbergData.includes(searchTerm);
            
            // Se encontrou, também destaca o texto encontrado
            if (found && searchTerm) {
                // Destaca no título se encontrou
                if (formTitle.includes(searchTerm)) {
                    const highlightedTitle = $link.contents().first().text().replace(
                        new RegExp(searchTerm, 'gi'),
                        match => `<mark>${match}</mark>`
                    );
                    $link.contents().first().replaceWith(highlightedTitle);
                }
                
                // Mostra preview do conteúdo Gutenberg se encontrou lá
                if (gutenbergData.includes(searchTerm)) {
                    let preview = gutenbergData;
                    const index = preview.indexOf(searchTerm);
                    const start = Math.max(0, index - 30);
                    const end = Math.min(preview.length, index + searchTerm.length + 30);
                    preview = '...' + preview.substring(start, end) + '...';
                    preview = preview.replace(
                        new RegExp(searchTerm, 'gi'),
                        match => `<mark>${match}</mark>`
                    );
                    
                    // Adiciona ou atualiza preview
                    let $preview = $item.find('.gutenberg-preview');
                    if (!$preview.length) {
                        $preview = $('<div class="gutenberg-preview"></div>').appendTo($item);
                    }
                    $preview.html(preview);
                } else {
                    $item.find('.gutenberg-preview').remove();
                }
            } else {
                // Remove highlights e preview se não encontrou
                $item.find('mark').contents().unwrap();
                $item.find('.gutenberg-preview').remove();
            }
            
            $item.toggle(found);
        });
    });

    // Marca o formulário ativo
    $('.form-link').on('click', function() {
        $('.form-link').removeClass('active');
        $(this).addClass('active');
    });
});